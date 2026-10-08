import os
import re
import json
import time
import math
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, Header
from .llm import LLMClient
from .auth import verify_service_jwt

router = APIRouter(prefix="/api/v1/ai-mode", tags=["AI Mode"])

# -------------------------------------------------------------
# Data Models
# -------------------------------------------------------------
class AIModeProductVariant(BaseModel):
    id: str
    title: str
    price: float
    sale_price: Optional[float] = None
    in_stock: bool = True
    sku: Optional[str] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)

class AIModeProduct(BaseModel):
    id: str
    title: str
    handle: Optional[str] = None
    description: Optional[str] = ""
    price: float
    sale_price: Optional[float] = None
    currency: str = "INR"
    category: str = "General"
    subcategories: List[str] = Field(default_factory=list)
    brand: Optional[str] = "Merchant"
    images: List[str] = Field(default_factory=list)
    in_stock: bool = True
    variants: List[AIModeProductVariant] = Field(default_factory=list)
    attributes: Dict[str, Any] = Field(default_factory=dict)
    source_url: Optional[str] = None
    score: Optional[float] = None

class SearchConstraint(BaseModel):
    field: str
    operator: str
    value: Any
    is_hard: bool = True
    is_variant_level: bool = False
    confidence: float = 0.95
    raw_token: Optional[str] = None

class AIModeSearchPlan(BaseModel):
    original_query: str
    intent: str = "DISCOVERY"
    product_concepts: List[str] = Field(default_factory=list)
    hard_constraints: List[SearchConstraint] = Field(default_factory=list)
    soft_preferences: List[str] = Field(default_factory=list)
    semantic_query: str
    lexical_query: str
    exclusions: List[str] = Field(default_factory=list)
    sorting: str = "relevance"
    sort: str = "relevance"
    confidence: float = 0.95
    extracted_filters: Dict[str, Any] = Field(default_factory=dict)
    pagination: Dict[str, int] = Field(default_factory=lambda: {"page": 1, "page_size": 48})

class SearchRequest(BaseModel):
    query: str
    workspace_id: Optional[str] = None
    previous_state: Optional[AIModeSearchPlan] = None
    page: Optional[int] = 1
    page_size: Optional[int] = 48

class SearchResponse(BaseModel):
    products: List[AIModeProduct]
    total_matches: int
    page: int
    page_size: int
    has_more: bool
    applied_filters: Dict[str, Any]
    search_plan: AIModeSearchPlan
    latency_ms: float

class ChatRequest(BaseModel):
    workspace_id: str
    user_message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    conversation_id: str
    workspace_id: str
    role: str = "assistant"
    content: str
    products: List[AIModeProduct] = Field(default_factory=list)
    recommendations: Optional[List[AIModeProduct]] = None
    comparison: Optional[Dict[str, Any]] = None
    cart_action_performed: Optional[Dict[str, Any]] = None
    created_at: str

# -------------------------------------------------------------
# Query Understanding Engine (Python)
# -------------------------------------------------------------
GENERAL_STOP_WORDS = {
    'product', 'products', 'item', 'items', 'show', 'me', 'find', 'get', 'give',
    'all', 'the', 'a', 'an', 'in', 'for', 'of', 'to', 'with', 'and', 'or', 'some',
    'please', 'looking', 'look', 'want', 'need', 'buy', 'shop', 'display', 'list',
    'available', 'good', 'best', 'top', 'any', 'have', 'you', 'can', 'is', 'are',
    'rupee', 'rupees', 'rs', 'inr', 'buck', 'bucks', 'price', 'cost', 'budget',
    'around', 'approx', 'rate', 'rates', 'worth', 'value', 'under', 'below', 'above',
    'which', 'that', 'this', 'ones', 'only', 'from', 'between', 'upto', 'less', 'more', 'than'
}

SOFT_PREFERENCES = {
    'casual', 'formal', 'elegant', 'stylish', 'modern', 'vintage', 'classic', 'chic',
    'party', 'wedding', 'festive', 'festival', 'office', 'work', 'workplace', 'daily',
    'summer', 'winter', 'autumn', 'spring', 'vacation', 'comfortable', 'luxury', 'premium'
}

DEMOGRAPHIC_ALIASES = {
    'men': 'men', 'man': 'men', 'mens': 'men', "men's": 'men', 'male': 'men', 'gents': 'men', 'boys': 'men', 'boy': 'men', 'father': 'men',
    'women': 'women', 'woman': 'women', 'womens': 'women', "women's": 'women', 'female': 'women', 'ladies': 'women', 'lady': 'women', 'girls': 'women', 'girl': 'women', 'sister': 'women', 'mother': 'women',
    'kids': 'kids', 'kid': 'kids', 'children': 'kids', 'child': 'kids', 'baby': 'kids', 'toddler': 'kids',
    'unisex': 'unisex', 'couple': 'unisex', 'couples': 'unisex'
}

COMMON_CATEGORIES = {
    'dress': 'dress', 'dresses': 'dress', 'saree': 'saree', 'sarees': 'saree', 'sari': 'saree',
    'kurti': 'kurti', 'kurtis': 'kurti', 'kurta': 'kurti', 'shirt': 'shirt', 'shirts': 'shirt',
    'tshirt': 't-shirt', 't-shirt': 't-shirt', 'tshirts': 't-shirt', 't-shirts': 't-shirt', 'tee': 't-shirt',
    'jogger': 'joggers', 'joggers': 'joggers', 'pant': 'pants', 'pants': 'pants', 'trouser': 'pants', 'jeans': 'pants',
    'shoe': 'shoes', 'shoes': 'shoes', 'bag': 'bags', 'bags': 'bags', 'sleeve': 'sleeves', 'sleeves': 'sleeves'
}

def parse_query(raw_query: str) -> AIModeSearchPlan:
    # De-concatenate compound words (e.g. "womenproducts" -> "women products", "womendress" -> "women dress")
    norm_query = raw_query.strip()
    norm_query = re.sub(r'\b(women|woman|womens|women\'s|female|ladies|lady|girl|girls)(products?|items?|clothes|clothing|wear|dresses?|sarees?|shirts?|tops?|shoes?|tshirts?|pants?|apparel)\b', r'\1 \2', norm_query, flags=re.IGNORECASE)
    norm_query = re.sub(r'\b(men|man|mens|men\'s|male|boys?|father)(products?|items?|clothes|clothing|wear|shirts?|tshirts?|pants?|joggers?|shoes?|apparel)\b', r'\1 \2', norm_query, flags=re.IGNORECASE)
    norm_query = re.sub(r'\b(kids?|children|baby|toddler)(products?|items?|clothes|clothing|wear|shirts?|dresses?|shoes?|apparel)\b', r'\1 \2', norm_query, flags=re.IGNORECASE)

    query_clean = norm_query.strip()
    query_lower = query_clean.lower()

    # 1. Intent classification
    intent = "DISCOVERY"
    if re.search(r'\b(compare|which\s+is\s+better|difference\s+between|vs)\b', query_lower):
        intent = "COMPARISON"
    elif re.search(r'\b(recommend|suggest|what\s+should\s+i\s+(?:buy|get)|best\s+for)\b', query_lower):
        intent = "RECOMMENDATION"

    hard_constraints = []
    soft_preferences = []
    exclusions = []
    product_concepts = []
    extracted_filters: Dict[str, Any] = {}

    # 2. Exclusions ("not red", "without sleeves")
    for match in re.finditer(r'\b(?:not|without|no|exclude|except|non-?)\s+([a-z0-9\-_]+)\b', query_lower):
        term = match.group(1).strip()
        if term and term not in GENERAL_STOP_WORDS:
            exclusions.append(term)
            hard_constraints.append(SearchConstraint(field="all", operator="NOT_IN", value=term, is_hard=True))

    # 3. Price Bounds
    # Range
    range_match = re.search(r'(?:between|from)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?)\s*(?:to|-|and)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?)', query_lower)
    if range_match:
        min_p = float(range_match.group(1).replace(',', ''))
        max_p = float(range_match.group(2).replace(',', ''))
        extracted_filters["min_price"] = min_p
        extracted_filters["max_price"] = max_p
        hard_constraints.append(SearchConstraint(field="price", operator=">=", value=min_p, is_hard=True, is_variant_level=True))
        hard_constraints.append(SearchConstraint(field="price", operator="<=", value=max_p, is_hard=True, is_variant_level=True))
    else:
        # Upper bound: "under 1000", "below 1500"
        under_match = re.search(r'(?:under|below|less\s+than|max(?:imum)?|budget|within|upto|up\s+to)\s*(?:rs\.?|inr|₹|\$)?\s*(\d+(?:,\d+)?)', query_lower)
        if under_match:
            max_p = float(under_match.group(1).replace(',', ''))
            extracted_filters["max_price"] = max_p
            hard_constraints.append(SearchConstraint(field="price", operator="<=", value=max_p, is_hard=True, is_variant_level=True))

        # Direct standalone currency: "1000 rupees", "1000 rs", "₹1000"
        if "max_price" not in extracted_filters:
            cur_match = re.search(r'(\d+(?:,\d+)?)\s*(?:rs\.?|inr|rupees?|bucks?|₹|\$)', query_lower) or re.search(r'(?:product|products|item|items)\s+(\d{2,6})\b', query_lower)
            if cur_match:
                max_p = float(cur_match.group(1).replace(',', ''))
                extracted_filters["max_price"] = max_p
                hard_constraints.append(SearchConstraint(field="price", operator="<=", value=max_p, is_hard=True, is_variant_level=True))

    # 4. Gender / Demographic Audience
    for alias, norm_gender in DEMOGRAPHIC_ALIASES.items():
        if re.search(rf'\b{re.escape(alias)}\b', query_lower) and alias not in exclusions:
            extracted_filters["gender"] = norm_gender
            hard_constraints.append(SearchConstraint(field="audience", operator="=", value=norm_gender, is_hard=True))
            break

    # 5. Category
    for term, norm_cat in COMMON_CATEGORIES.items():
        if re.search(rf'\b{re.escape(term)}\b', query_lower) and term not in exclusions:
            extracted_filters["category"] = norm_cat
            product_concepts.append(norm_cat)
            hard_constraints.append(SearchConstraint(field="category", operator="=", value=norm_cat, is_hard=True))
            break

    # 6. Soft preferences
    raw_tokens = re.findall(r'\b[a-z0-9\-_]+\b', query_lower)
    for t in raw_tokens:
        if t in SOFT_PREFERENCES and t not in exclusions:
            soft_preferences.append(t)

    # 7. Sorting
    sorting = "relevance"
    if re.search(r'\b(cheap|cheaper|lowest\s+price|low\s+to\s+high)\b', query_lower):
        sorting = "price_asc"
    elif re.search(r'\b(expensive|highest\s+price|high\s+to\s+low)\b', query_lower):
        sorting = "price_desc"

    lexical_tokens = [t for t in raw_tokens if t not in GENERAL_STOP_WORDS and t not in exclusions and not t.isdigit()]

    return AIModeSearchPlan(
        original_query=raw_query,
        intent=intent,
        product_concepts=product_concepts,
        hard_constraints=hard_constraints,
        soft_preferences=soft_preferences,
        semantic_query=query_clean,
        lexical_query=" ".join(lexical_tokens),
        exclusions=exclusions,
        sorting=sorting,
        sort=sorting,
        confidence=0.95,
        extracted_filters=extracted_filters,
        pagination={"page": 1, "page_size": 48}
    )

# -------------------------------------------------------------
# Deterministic Constraint Evaluator (Python)
# -------------------------------------------------------------
def evaluate_product(product: AIModeProduct, plan: AIModeSearchPlan) -> bool:
    title_lower = (product.title or "").lower()
    desc_lower = (product.description or "").lower()
    cat_lower = (product.category or "").lower()
    tags_lower = [t.lower() for t in (product.subcategories or [])]
    all_text = f"{title_lower} {desc_lower} {cat_lower} {' '.join(tags_lower)}"

    # 1. Negative Exclusions
    if plan.exclusions:
        for excl in plan.exclusions:
            if re.search(rf'\b{re.escape(excl.lower())}\b', all_text):
                return False

    # 2. Demographic Isolation & Couple Combo Handling
    target_gender = plan.extracted_filters.get("gender")
    is_combo_query = bool(re.search(r'\b(couple|combo|box|bundle|matching|pair|set)\b', plan.original_query.lower()))
    is_product_combo = ('combo' in cat_lower or 'box' in cat_lower or 'couple' in cat_lower or 
                         'couple combo' in title_lower or 'combo box' in title_lower or 'shirt and saree combo' in title_lower)

    if target_gender:
        is_explicitly_women = bool(re.search(r'\b(women|woman|womens|women\'s|female|ladies|lady|girl|girls|saree|sarees|bow|bows|scrunchie|scrunchies|dress|dresses|kurti|kurtis|skirt|skirts|blouse)\b', all_text)) or any('women' in t or 'saree' in t or 'kurti' in t for t in tags_lower) or 'saree' in cat_lower or 'women' in cat_lower
        is_explicitly_men = bool(re.search(r'\b(men|mens|men\'s|male|man|guys|boy|boys|father)\b', all_text)) or any(t in ['men', 'mens', "men's", 'men shirt'] for t in tags_lower) or 'men' in cat_lower
        is_explicitly_unisex = bool(re.search(r'\b(unisex|all\s+genders?)\b', all_text)) or 'unisex' in tags_lower

        if target_gender == "women":
            # Disqualify couple combos unless user asked for combos
            if is_product_combo and not is_combo_query:
                return False
            # Must be affirmative women or unisex
            if not is_explicitly_women and not is_explicitly_unisex:
                return False
            if is_explicitly_men and not is_explicitly_women:
                return False

        elif target_gender == "men":
            if is_product_combo and not is_combo_query:
                return False
            if is_explicitly_women and not is_explicitly_men and not is_explicitly_unisex:
                return False
            if 'women' in tags_lower and 'men' not in tags_lower and not is_explicitly_unisex:
                return False

    # 3. Category / Product Type Precision Check
    req_cat = plan.extracted_filters.get("category")
    if req_cat:
        root_cat = re.sub(r'(es|s)$', '', req_cat.lower().strip())
        
        # Disqualify combos from standalone single-item searches (e.g. "saree", "shirt")
        if is_product_combo and not is_combo_query and root_cat in ['saree', 'shirt', 'dress', 'kurti', 'pant', 'jogger', 't-shirt', 'shoe', 'bag']:
            return False

        cat_synonyms = {
            'dress': ['dress', 'dresses', 'saree', 'sarees', 'kurti', 'kurtis', 'gown', 'gowns', 'skirt'],
            'saree': ['saree', 'sarees', 'sari', 'saris'],
            'kurti': ['kurti', 'kurtis', 'kurta', 'kurtas', 'suit'],
            'shirt': ['shirt', 'shirts', 'tshirt', 't-shirt', 'tee', 'tees', 'top'],
            't-shirt': ['tshirt', 't-shirt', 't-shirts', 'tshirts', 'tee', 'tees'],
            'joggers': ['jogger', 'joggers', 'pant', 'pants', 'trouser', 'trackpant'],
            'pants': ['pant', 'pants', 'trouser', 'trousers', 'jeans', 'jogger']
        }
        syn_list = cat_synonyms.get(req_cat.lower(), cat_synonyms.get(root_cat, [req_cat.lower()]))
        syn_pattern = rf'\b({"|".join([re.escape(s) for s in syn_list])})\b'
        
        matches_cat = bool(re.search(syn_pattern, cat_lower) or re.search(syn_pattern, title_lower) or any(re.search(syn_pattern, t) for t in tags_lower))
        if not matches_cat:
            return False

    # 4. Price Constraint Validation
    max_price = plan.extracted_filters.get("max_price")
    min_price = plan.extracted_filters.get("min_price")

    if product.variants:
        valid_var = False
        for v in product.variants:
            v_pass = True
            if max_price is not None and v.price > max_price:
                v_pass = False
            if min_price is not None and v.price < min_price:
                v_pass = False
            if v_pass:
                valid_var = True
                break
        if not valid_var:
            return False
    else:
        if max_price is not None and product.price > max_price:
            return False
        if min_price is not None and product.price < min_price:
            return False

    return True

# -------------------------------------------------------------
# Database Product Loader (Shared JSON Store)
# -------------------------------------------------------------
def load_catalog_products(workspace_id: Optional[str] = None) -> List[AIModeProduct]:
    from .db.database import DEFAULT_DB_PATH
    import sqlite3

    db_products = []
    # Fast synchronous SQLite/database reader for high-performance AI Mode search queries
    if os.path.exists(DEFAULT_DB_PATH):
        try:
            conn = sqlite3.connect(DEFAULT_DB_PATH)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            query = "SELECT * FROM commerce_products"
            params = []
            if workspace_id:
                query += " WHERE workspace_id = ?"
                params.append(workspace_id)
            cur.execute(query, params)
            rows = cur.fetchall()
            for r in rows:
                variants_raw = json.loads(r["variants_json"] or "[]")
                variants = [
                    AIModeProductVariant(
                        id=v.get("id", ""),
                        title=v.get("title", ""),
                        price=float(v.get("price", 0)),
                        in_stock=(v.get("inventory_quantity", 1) or 1) > 0,
                        attributes=v.get("attributes", {})
                    )
                    for v in variants_raw
                ]
                db_products.append(AIModeProduct(
                    id=r["id"],
                    title=r["title"],
                    handle=r["id"],
                    description=r["description"] or "",
                    price=float(r["price"] or 0),
                    sale_price=float(r["compare_at_price"]) if r["compare_at_price"] else None,
                    currency="INR",
                    category=r["category"] or "General",
                    subcategories=json.loads(r["tags_json"] or "[]"),
                    brand=json.loads(r["attributes_json"] or "{}").get("brand", "Merchant"),
                    images=json.loads(r["images_json"] or "[]") or ([r["image_url"]] if r["image_url"] else []),
                    in_stock=bool(r["in_stock"]),
                    variants=variants,
                    attributes=json.loads(r["attributes_json"] or "{}"),
                    source_url=r["source_url"]
                ))
            conn.close()
            if db_products:
                return db_products
        except Exception as e:
            print("AI Mode DB fetch notice:", e)

    db_paths = [
        os.path.join(os.getcwd(), "data", "aaas.db.json"),
        os.path.join(os.getcwd(), "..", "data", "aaas.db.json"),
        "/app/data/aaas.db.json"
    ]
    raw_products = []
    for path in db_paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    raw_products = data.get("commerce_products", [])
                    break
            except Exception as e:
                print(f"Error loading {path}: {e}")

    result = []
    for p in raw_products:
        if workspace_id and p.get("workspace_id") != workspace_id:
            continue
        variants = [
            AIModeProductVariant(
                id=v.get("id", ""),
                title=v.get("title", ""),
                price=float(v.get("price", 0)),
                in_stock=(v.get("inventory_quantity", 1) or 1) > 0,
                attributes=v.get("attributes", {})
            )
            for v in p.get("variants", [])
        ]
        result.append(AIModeProduct(
            id=p.get("id", ""),
            title=p.get("title", ""),
            handle=p.get("id", ""),
            description=p.get("description", ""),
            price=float(p.get("price", 0)),
            sale_price=float(p.get("compare_at_price")) if p.get("compare_at_price") else None,
            currency=p.get("currency", "INR"),
            category=p.get("category", "General"),
            subcategories=p.get("tags", []),
            brand=p.get("attributes", {}).get("brand", "Merchant"),
            images=p.get("images", []),
            in_stock=p.get("in_stock", True),
            variants=variants,
            attributes=p.get("attributes", {}),
            source_url=p.get("source_url")
        ))
    return result

# -------------------------------------------------------------
# API Endpoints
# -------------------------------------------------------------
@router.post("/search", response_model=SearchResponse)
async def ai_search_endpoint(req: SearchRequest):
    start_time = time.time()
    plan = parse_query(req.query)
    all_products = load_catalog_products(req.workspace_id)

    valid_candidates = []
    lexical_tokens = plan.lexical_query.lower().split() if plan.lexical_query else []

    for product in all_products:
        if not evaluate_product(product, plan):
            continue

        # Composite Relevance Score
        title_lower = product.title.lower()
        cat_lower = product.category.lower()
        score = 0.50

        # Exact category match boost
        if plan.product_concepts:
            for c in plan.product_concepts:
                if c.lower() in cat_lower or c.lower() in title_lower:
                    score += 0.35
                    break

        # Lexical match
        if lexical_tokens:
            hits = sum(1 for t in lexical_tokens if t in title_lower or t in cat_lower)
            score += (hits / len(lexical_tokens)) * 0.25

        product.score = round(min(0.99, score), 2)
        valid_candidates.append(product)

    # Sorting
    if plan.sorting == "price_asc":
        valid_candidates.sort(key=lambda p: p.price)
    elif plan.sorting == "price_desc":
        valid_candidates.sort(key=lambda p: p.price, reverse=True)
    else:
        valid_candidates.sort(key=lambda p: p.score or 0.5, reverse=True)

    page = req.page or 1
    page_size = req.page_size or 48
    start_idx = (page - 1) * page_size
    paginated = valid_candidates[start_idx : start_idx + page_size]

    return SearchResponse(
        products=paginated,
        total_matches=len(valid_candidates),
        page=page,
        page_size=page_size,
        has_more=start_idx + page_size < len(valid_candidates),
        applied_filters=plan.extracted_filters,
        search_plan=plan,
        latency_ms=round((time.time() - start_time) * 1000, 2)
    )

@router.post("/chat", response_model=ChatResponse)
async def ai_chat_endpoint(req: ChatRequest):
    plan = parse_query(req.user_message)
    search_res = await ai_search_endpoint(SearchRequest(query=req.user_message, workspace_id=req.workspace_id))
    products = search_res.products

    # 1. RAG Knowledge Retrieval (Policies, FAQs, Store Guides)
    rag_context = ""
    try:
        from .rag import fetch_tenant_chunks_from_db, execute_rag_pipeline
        chunks = await fetch_tenant_chunks_from_db(req.workspace_id)
        if chunks:
            rag_res = execute_rag_pipeline(req.user_message, workspace_id=req.workspace_id, tenant_chunks=chunks, top_k=3)
            if rag_res.get("citations"):
                rag_context = "\n\n".join([f"[Source: {c['source']}]: {c['text']}" for c in rag_res["citations"]])
    except Exception as e:
        print(f"RAG retrieval notice: {e}")

    # 2. LLM Synthesis using Sarvam AI / OpenAI Client
    llm = LLMClient()
    assistant_text = f"Found {search_res.total_matches} matching product(s) in our collection:"
    
    if len(products) == 0 and not rag_context:
        assistant_text = f"I couldn't find any products matching \"{req.user_message}\". Try exploring our featured categories."
    elif plan.intent == "RECOMMENDATION":
        assistant_text = "Based on your preferences, here are handpicked recommendations from our catalog:"

    if llm.is_configured():
        try:
            prod_summary = "\n".join([f"- {p.title} (₹{p.price}): {p.description[:80]}" for p in products[:4]])
            prompt_parts = [f"User is shopping on our store and asked: '{req.user_message}'."]
            
            if prod_summary:
                prompt_parts.append(f"Verified catalog products:\n{prod_summary}")
            if rag_context:
                prompt_parts.append(f"Relevant store policy and FAQ context:\n{rag_context}")
                
            prompt_parts.append("Provide a warm, concise 1-2 sentence response guiding the customer accurately.")
            
            prompt = "\n\n".join(prompt_parts)
            res = llm.call_model(
                messages=[{"role": "user", "content": prompt}],
                tools=[]
            )
            if res.get("response"):
                assistant_text = res["response"]
        except Exception as e:
            print(f"LLM generation notice: {e}")

    return ChatResponse(
        conversation_id=req.conversation_id or f"conv_{int(time.time()*1000)}",
        workspace_id=req.workspace_id,
        role="assistant",
        content=assistant_text,
        products=products,
        recommendations=products[:3] if plan.intent == "RECOMMENDATION" else None,
        created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )

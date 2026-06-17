from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def root():
    """
    # hi
    Retrieve a single item by its ID.

    This is the **detailed description** that appears in Swagger UI.
    - Supports path parameters
    - Returns JSON with item details
    - Raises 404 if not found

    Very useful for long explanations, lists, examples, etc.
    """

    return {"message": "Hello World"}

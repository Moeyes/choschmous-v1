from datetime import datetime
from pydantic import BaseModel
from pydantic import ConfigDict


class CategoryPublic(BaseModel):
    id: int
    sport_name: str | None
    category: str
    gender: str | None = None
    team_size_min: int | None = None
    team_size_max: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def model_validate(cls, obj):
        # Convert genderEnum to lowercase string if present
        if hasattr(obj, "gender") and obj.gender is not None:
            gender_val = (
                obj.gender.value if hasattr(obj.gender, "value") else str(obj.gender)
            )
            obj = obj.__class__(**{**obj.__dict__, "gender": gender_val.lower()})
        return super().model_validate(obj)

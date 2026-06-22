from src.models.enum.user import IdDocumentType, genderEnum
from src.schemas.enroll import FullRegistrationRequest


def _body(**overrides):
    body = {
        "eventId": 1,
        "organizationId": 2,
        "sportId": 3,
        "categoryId": 4,
        "lastNameKhmer": "សុខ",
        "firstNameKhmer": "ដារ៉ា",
        "lastNameLatin": "Sok",
        "firstNameLatin": "Dara",
        "phone": "012345678",
        "gender": "Male",
        "dateOfBirth": "2010-01-01",
        "idDocType": "IDCARD",
        "role": "Athlete",
        "nationality": "Khmer",
    }
    body.update(overrides)
    return body


def test_registration_schema_accepts_frontend_normalized_document_type():
    payload = FullRegistrationRequest.model_validate(_body())

    assert payload.id_document_type == IdDocumentType.CAM_NID.value
    assert payload.gender == genderEnum.MALE.value
    assert payload.nationality == "Khmer"


def test_registration_schema_ignores_extra_frontend_fields():
    payload = FullRegistrationRequest.model_validate(
        _body(eventName="Games", selectedDocKeys="national-id")
    )

    assert payload.eventId == 1

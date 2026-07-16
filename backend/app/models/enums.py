import enum


class AppRole(str, enum.Enum):
    admin = "admin"
    gsm = "gsm"
    operator = "operator"
    master = "master"
    management = "management"


class FuelUnit(str, enum.Enum):
    litr = "litr"
    m3 = "m3"

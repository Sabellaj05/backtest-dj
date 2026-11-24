import importlib
import logging

logger = logging.getLogger(__name__)


def create_strategy(strategy_name: str):
    """
    Dynamically load and return a strategy class from ``core.strategies``.

    Expects module ``core.strategies.<strategy_name>`` containing a PascalCase
    class matching ``strategy_name`` (e.g., ``sma_cross`` -> ``SmaCross``).
    """
    try:
        module_path = f"core.strategies.{strategy_name}"
        module = importlib.import_module(module_path)
        class_name = "".join(word.capitalize() for word in strategy_name.split("_"))
        return getattr(module, class_name)
    except (ImportError, AttributeError):
        logger.warning("Strategy '%s' could not be resolved.", strategy_name)
        return None

import importlib

def create_strategy(strategy_name: str):
    """
    Factory function to dynamically load and return a strategy class.
    """
    try:
        # Convention: strategy file is in core.strategies.<strategy_name>
        module_path = f"core.strategies.{strategy_name}"
        module = importlib.import_module(module_path)

        # Convention: class name is CamelCase version of file name
        # e.g., sma_cross -> SmaCross
        class_name = "".join(word.capitalize() for word in strategy_name.split('_'))
        
        strategy_class = getattr(module, class_name)
        return strategy_class

    except (ImportError, AttributeError):
        # Handle cases where the strategy doesn't exist
        return None

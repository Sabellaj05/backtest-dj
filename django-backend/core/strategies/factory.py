import importlib

def create_strategy(strategy_name: str):
    """
    Factory function to dynamically load and return a strategy class.
 """
    try:
        # Convention: strategy file is in core.strategies.<strategy_name>
        # nos da el path por ejemplo de core.strategies.la_bomba
        module_path = f"core.strategies.{strategy_name}"
        # referencia a el archivo/modulo la_bomba.py
        module = importlib.import_module(module_path)

        # Convention: class name is CamelCase version of file name
        # e.g., sma_cross -> SmaCross
        class_name = "".join(word.capitalize() for word in strategy_name.split('_'))
        # pasamos de la_bomba -> LaBomba
        
        # buscamos dentro del modulo la_bomba.py la clase LaBomba
        strategy_class = getattr(module, class_name)
        # `getattr` is used here to dynamically access a class within a module
        # when you only have the class's name as a string.
        # This is the heart of the factory pattern in this code, as it allows you to
        # select and instantiate different classes without needing a giant if/elif/else block.

        return strategy_class

    except (ImportError, AttributeError):
        print(f"Error la estrategia: {strategy_name} no esta implementada")

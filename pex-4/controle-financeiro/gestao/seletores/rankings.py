def __getattr__(name):
    def stub(*args, **kwargs):
        return []

    return stub

from noprogress import app

assert app.config.get("TEST", False), "cannot run tests with a non-test config"

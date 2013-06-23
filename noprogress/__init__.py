from flask import Flask
from flask.ext.sqlalchemy import SQLAlchemy

import venusian

import noprogress

app = Flask(__name__, instance_relative_config=True)
app.config.from_object("noprogress.default_settings")
app.config.from_envvar("NOPROGRESS_SETTINGS")
db = SQLAlchemy(app)

if not app.debug:
    import logging
    from logging.handlers import SMTPHandler
    mail_handler = SMTPHandler("127.0.0.1",
                               "error@noprogress-rfw.rhcloud.com",
                               app.config["ADMINS"], "noprogress error")
    mail_handler.setLevel(logging.ERROR)
    app.logger.addHandler(mail_handler)

scanner = venusian.Scanner()
scanner.scan(noprogress)

def main():
    app.run()

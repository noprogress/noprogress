from flask import Flask, session
from flask.ext.sqlalchemy import SQLAlchemy
from flask.ext.assets import Environment, Bundle

import venusian

import noprogress

app = Flask(__name__, instance_relative_config=True)
app.config.from_object("noprogress.default_settings")
app.config.from_envvar("NOPROGRESS_SETTINGS")
db = SQLAlchemy(app)
assets = Environment(app)

assets.register("js_all", Bundle("js/vendor/jquery.js", "js/foundation.min.js", "js/lodash.js",
                                 "js/foundation-datepicker.js", "js/d3.v3.js", "js/angular.js",
                                 "app/swolparser.js", "app/main.js",
                                 filters="uglifyjs", output="gen/packed.js"))

assets.register("css_all", Bundle("css/normalize.css", "css/general_foundicons.css",
                                  "css/foundation.css", "css/noprogress.css",
                                  filters="cleancss", output="gen/packed.css"))

if not app.debug:
    import logging
    from logging.handlers import SMTPHandler
    import pprint

    class MySMTPHandler(SMTPHandler):
        def format(self, record):
            return """\
Flask session data:
{session}

{msg}
""".format(session=pprint.pformat(dict(session)),
           msg=super(MySMTPHandler, self).format(record))

    mail_handler = MySMTPHandler("127.0.0.1",
                                 "error@noprogress-rfw.rhcloud.com",
                                 app.config["ADMINS"], "noprogress error")
    mail_handler.setLevel(logging.ERROR)
    app.logger.addHandler(mail_handler)

scanner = venusian.Scanner()
scanner.scan(noprogress, ignore=[".tests"])


def main():
    app.run()

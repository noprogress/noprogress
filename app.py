#!/usr/bin/env python
import imp
import os
import sys

try:
   zvirtenv = os.path.join(os.environ['OPENSHIFT_HOMEDIR'], 'python',
                           'virtenv', 'bin', 'activate_this.py')
   execfile(zvirtenv, dict(__file__ = zvirtenv) )
except IOError:
   pass


def run_gevent_server(app, ip, port=8080):
   from gevent.pywsgi import WSGIServer
   WSGIServer((ip, port), app).serve_forever()


def run_simple_httpd_server(app, ip, port=8080):
   from wsgiref.simple_server import make_server
   make_server(ip, port, app).serve_forever()


#
# IMPORTANT: Put any additional includes below this line.  If placed above this
# line, it's possible required libraries won't be in your searchable path
# 


#
#  main():
#
if __name__ == '__main__':
   ip   = os.environ['OPENSHIFT_PYTHON_IP']
   port = int(os.environ['OPENSHIFT_PYTHON_PORT'])
   zapp = imp.load_source('application', 'wsgi/application')

   #  Use gevent if we have it, otherwise run a simple httpd server.
   try:
      run_gevent_server(zapp.application, ip, port)
   except:
      run_simple_httpd_server(zapp.application, ip, port)


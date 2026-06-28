#!/bin/bash
export PATH=$HOME/.bun/bin:$PATH
cd /var/www/venezuelaselevanta/scripts
/usr/bin/node sync-venezuelatebusca.mjs
/usr/bin/node sync-localizapacientes.mjs

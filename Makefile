TODAY :=$(shell date +%F)
DIR := artifact
WWW := docs
DAILY := $(wildcard data/2020-??-??.json)

$(WWW)/today.html: $(DIR)/$(TODAY)-status.json $(WWW)/today.json
	echo 'foo' >> $(WWW)/foo
	git config user.name "Actions"
	git config user.email "kurimareiji@kurimai.com"
	git add $(DIR)/$(TODAY)-status.json $(WWW)
	git commit -m '$(TODAY)'
	git push

$(WWW)/today.json: $(DIR)/$(TODAY)-status.json
	node merge.js

$(DIR)/$(TODAY)-status.json:
	test -e $(DIR)/$(TODAY)-status.json || echo '{}' > $(DIR)/$(TODAY)-status.json
	node study-status.js


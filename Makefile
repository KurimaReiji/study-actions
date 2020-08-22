TODAY :=$(shell date +%F)
DIR := artifact
WWW := docs
DAILY := $(wildcard data/2020-??-??.json)

$(WWW)/index.html: $(DIR)/$(TODAY)-status.json $(WWW)/data.json $(WWW)/today.json $(DIR)/today.json
	echo 'foo' >> $(WWW)/foo
	touch $(WWW)/index.html
	git config user.name "Actions"
	git config user.email "kurimareiji@kurimai.com"
	git add $(DIR)/$(TODAY)-status.json data $(WWW)
	git add docs/data.json 
	git commit -m '$(TODAY)'
	git push

$(WWW)/data.json: $(DAILY)
	jq -s '.|add' data/2020-??-??.json > $(WWW)/data.json

$(WWW)/today.json: $(DIR)/$(TODAY)-status.json
	node merge.js

$(DIR)/$(TODAY)-status.json:
	test -e $(DIR)/$(TODAY)-status.json || echo '{}' > $(DIR)/$(TODAY)-status.json
	node study-status.js

.PHONY: scraper
scraper: 
	test -e $(DIR)/$(TODAY)-status.json || echo '{}' > $(DIR)/$(TODAY)-status.json
	node study-status.js


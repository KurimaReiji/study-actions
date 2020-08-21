TODAY :=$(shell date +%F)
DIR := artifact
WWW := docs
DAILY := $(wildcard data/2020-??-??.json)

$(WWW)/index.html: $(DIR)/$(TODAY)-status.json $(WWW)/data.json
	git config user.name "Actions"
	git config user.email "kurimareiji@kurimai.com"
	git add $(DIR)/$(TODAY)-status.json data
	git add docs/data.json 
	git commit -m '$(TODAY)'
	git push
	touch docs/index.html

$(WWW)/data.json: $(DAILY)
	jq -s '.|add' data/2020-??-??.json > docs/data.json

$(DIR)/today.json: $(DIR)/$(TODAY)-status.json
	node merge.js

$(WWW)/today.json: $(DIR)/today.json
	cp $(DIR)/today.json $(WWW)/today.json

$(DIR)/$(TODAY)-status.json:
	test -e $(DIR)/$(TODAY)-status.json || echo '{}' > $(DIR)/$(TODAY)-status.json
	node study-status.js

.PHONY: scraper
scraper: 
	test -e $(DIR)/$(TODAY)-status.json || echo '{}' > $(DIR)/$(TODAY)-status.json
	node study-status.js


TODAY :=$(shell date +%F)
DIR := artifact

docs/data.json: $(DIR)/$(TODAY).json $(DIR)/$(TODAY)-status.json
	jq -s '.|add' data/2020-??-??.json > docs/data.json
	git config user.name "kurimareiji"
	git config user.email "kurimareiji@kurimai.com"
	git add $(DIR)/$(TODAY)-status.json $(DIR)/$(TODAY).json data/$(TODAY).json
	git add docs/data.json 
	git commit -m '$(TODAY)'
	git push

$(DIR)/$(TODAY).json: $(DIR)/$(TODAY)-status.json
	node merge.js
	cp $(DIR)/$(TODAY).json data/$(TODAY).json

$(DIR)/$(TODAY)-status.json: 
	test -e $(DIR)/$(TODAY)-status.json || echo '{}' > $(DIR)/$(TODAY)-status.json
	node study-status.js

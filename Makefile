TODAY :=$(shell date +%F)
DIR := artifact

$(DIR)/$(TODAY).json: $(DIR)/$(TODAY)-status.json
	node study-status.js
	node merge.js
	node formatter.js
	cp $(DIR)/$(TODAY).json data/$(TODAY).json
	git config user.name "kurimareiji"
	git config user.email "kurimareiji@kurimai.com"
	git add $(DIR)/$(TODAY)-status.json $(DIR)/$(TODAY).json
	git commit -m '$(TODAY)'
	git push

$(DIR)/$(TODAY)-status.json: 
	test -e $(DIR)/$(TODAY)-status.json || echo '{}' > $(DIR)/$(TODAY)-status.json

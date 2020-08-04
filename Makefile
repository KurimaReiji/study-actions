TODAY :=$(shell date +%F)
DIR := artifact

$(DIR)/$(TODAY).json: $(DIR)/$(TODAY)-status.json
	node study-status.js
	node merge.js
	node formatter.js
$(DIR)/$(TODAY)-status.json: 
	test -e $(DIR)/$(TODAY)-status.json || echo '{}' > $(DIR)/$(TODAY)-status.json

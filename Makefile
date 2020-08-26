TODAY :=$(shell date +%F)
DIR := artifact
WWW := docs
DAILY := $(wildcard data/2020-??-??.json)

data/$(TODAY).json: merge.js
	test -e $(DIR)/$(TODAY)-status.json || echo '{}' > $(DIR)/$(TODAY)-status.json
	node study-status.js
	node merge.js
	echo $(TODAY) >> $(WWW)/foo
	git config user.name "Actions"
	git config user.email "kurimareiji@kurimai.com"
	git add $(DIR)/$(TODAY)-status.json $(WWW) data
	git commit -m '$(TODAY)'
	git push

$(WWW)/index.html: $(wildcard fragments/*.html)
	node create_index_html.js
	git config user.name "Actions"
	git config user.email "kurimareiji@kurimai.com"
	git add $(WWW) data fragments
	git commit -m '$(TODAY) www'
	git push

$(WWW)/data.json: $(wildcard data/2020-??-??.json)
	jq -s '.|add' data/2020-??-??.json > $(WWW)/data.json

data/teamStats.json: docs/data.json data2teamStats.js
	node data2teamStats.js

data/catchers.json: docs/data.json data2catchers.js
	node data2catchers.js

fragments/teamStats.html: data/teamStats.json templates/teamStats.ejs
	node create_html.js fragments/teamStats.html

fragments/catchers.html: data/catchers.json templates/catchers.ejs
	node create_html.js fragments/catchers.html


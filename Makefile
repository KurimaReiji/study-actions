TODAY :=$(shell date +%F)

$(TODAY).json:
	echo $(TODAY)
	node study0.js
	node formatter.js

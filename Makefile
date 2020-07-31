TODAY :=$(shell date +%F)

$(TODAY).json:
	echo $(TODAY)
	node today.js
	node formatter.js

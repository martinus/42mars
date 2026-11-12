;redcode-94
;name pfew
;author Neogryzor
;strategy	bomber tier
;assert 1




INIT:	JMZ #0,G
	JMZ #0,G+1
	JMZ -2,#0
FOR 4
	JMZ 0,0
ROF
G:	JMZ 0,1
	JMZ 0,-1

	END INIT

	
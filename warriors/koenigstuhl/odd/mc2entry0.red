;redcode-94
;name pfew
;author Neogryzor
;strategy	anti-bomber
;assert 1

INIT:	JMZ AT1,G
	JMZ AT2,G+1
	JMZ -2,#0
AT1:	JMZ.A 2,{-4
AT2:	JMZ.A 2,{-5
	JMZ.A -2,<-2
	JMZ.A -2,<-2
FOR 5
	JMZ 0,0
ROF
G:	JMZ 0,1
	JMZ 0,-1

	END INIT

	
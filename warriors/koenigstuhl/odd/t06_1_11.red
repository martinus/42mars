;redcode-94
;name D0b
;author donny
;strategy just to show that imps can survive in the 9240 core:)
;assert 1
org start
	dat	#4, #12
        dat     #1, (g=0)+(f=1)
idx     for     20
        dat     #idx+1, (f=f+g)+((g=f-g) && 0)
        rof

start 	SPL    #0, }1
	SPL    #0, }1
	JMZ.BA	96, 1
	SPL    #0, }1
        MOV.I  #1234, 1
for 95
	DIV.F	#4,	$0
rof
for 5
	MOV	-100,	5
rof
        dat     #1, (g=0)+(f=1)
idy     for     22
        dat     #idy+1, (f=f+g)+((g=f-g) && 0)
        rof

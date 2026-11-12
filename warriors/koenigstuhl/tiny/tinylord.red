;redcode-tiny
;name TinyLord
;author Neo
;assert 1
;strategy	Qbomb->paper/imp

	dest1 equ 7234
	QGAP EQU 7

QBOMB:				;The Quick punch :)
I FOR 9
	MOV.I {QBOMB-40-(2*I*QGAP),<QBOMB-40-((2*I+1)*QGAP)
ROF
launch:	spl 1,{QBOMB-40-(20*QGAP)
	spl 1,<QBOMB-40-(21*QGAP)
	spl thrd,{QBOMB-40-(22*QGAP)
scnd:	mov {frst,{1
	jmp *frst-267+4,<QBOMB-40-(23*QGAP)
thrd:	mov *frst,{1
	spl *frst+267+4,{QBOMB-40-(24*QGAP)
frst:	spl @4,<dest1
	mov }-1,>-1
	spl 268,<-10 	;overlapped med-weigh imp rings
	mov.i #267,*0

	end QBOMB

;redcode-94
;name TinyLord2
;author Neo
;assert 1
;strategy	Qbomb->paper/imp

	dest1 equ 3410
	QGAP EQU 7

QBOMB:				;The Quick punch :)
I FOR 5
	MOV.I {QBOMB-40-(2*I*QGAP),<QBOMB-40-((2*I+1)*QGAP)
ROF
launch:	spl 2,{QBOMB-40-(12*QGAP)
	spl 1,<QBOMB-40-(13*QGAP)
	spl thrd,{QBOMB-40-(14*QGAP)
scnd:	mov {frst,{2
	mov {frst,{1
	jmp *frst-267+6,<QBOMB-40-(15*QGAP)
thrd:	mov *frst,{2
	mov *frst,{1
	spl *frst+267+6,{QBOMB-40-(16*QGAP)
frst:	spl @6,<dest1
	mov }-1,>-1
	mov }-2,>-2
as:	spl #0,<-6
cs:	mov <-35,<-135
	mov.i #267,*0

	end QBOMB

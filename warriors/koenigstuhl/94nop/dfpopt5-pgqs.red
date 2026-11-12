;redcode-94nop
;name Dried Frog Pills E pgqs
;author Steve Gunnell
;strategy Qscan -> Newtish Stone / Imp
;strategy Klinesque style qscan
;assert CORESIZE==8000


GAP1  equ  15
GAP2  equ  2
GAP3  equ  0
START equ  2012
HOP	equ	(3+hit-gate1)

STEP     equ     1015
gate1   equ     (init-6)
dist    equ     5

ival    equ     (START-7862)
sep     equ     18
impy    equ     (imp+sep)
st      equ     2667

MARK	equ	>4490


bgo	SPL.B	iboot	,MARK
	MOV.I	cbomb	,@sptr
	MOV.I	<spos	,{sptr
	SPL	1	,MARK*2
	MOV.I	<spos	,{sptr
	MOV.I	<spos	,{sptr
	MOV.I	<spos	,{sptr
	DJN.B	*sptr	,#1
sptr	DIV.F	#init+START	,#init+START-7-dist

for GAP1
	dat.f	0	,0
rof

cbomb	dat.i	#1 	,HOP
; 2 DATS
init	SPL.B	#0	,<stone-STEP
stone	SPL.B	#STEP	,<-STEP
loop	MOV.I	{0+STEP	,hit-STEP
	ADD.F	stone	,loop
hit	DJN.F	loop	,<stone-STEP
	MOV.I	init-dist	,>gate1
last	DJN.F	-1	,>gate1

spos	DAT.F	0	,0

for GAP2
	dat.f	0	,0
rof

;;--------------------- Boot the imp/launch -------------------------

iboot	MOV.I	<ipos	,*iptr
	MOV.I	<ipos	,<iptr
	MOV.I	<ipos	,<iptr
	MOV.I	<ipos	,<iptr
	MOV.I	<ipos	,<iptr
	SPL.B	@iptr	,MARK*3

iptr	DIV.F	#init+ival+sep	,#init+ival
	dat.f	0	,0

spin	SPL.B	#st+1	,>prime
prime	MOV.I	impy	,impy
	ADD.F	spin	,jump
jump	JMP.B	impy-st-1	,<-535

imp	MOV.I	#st	,*0

ipos	DAT.F	0	,0

for GAP3
	dat.f	0	,0
rof

; P Kline from slowQscan with modified bombing
qM       equ     1710
qN       equ     1151
qStep    equ     31
qShf	equ	(1+3)
qTm	equ	1+(qStep/qShf)

qGo     sne     qPtr+(qM+0)*(qN+0)+qStep*0 ,qPtr+(qM+0)*(qN+0)+qStep*1
        seq     qPtr+(qM+0)*(qN+0)+qStep*2 ,qPtr+(qM+0)*(qN+0)+qStep*3
qJump   jmp     qDec
for 1 == 1
        sne     qPtr+(qM+1)*(qN+0)+qStep*0 ,qPtr+(qM+1)*(qN+0)+qStep*1
        seq     qPtr+(qM+1)*(qN+0)+qStep*2 ,qPtr+(qM+1)*(qN+0)+qStep*3
qAinc   jmp     qDec ,}qDec
rof
for 1 == 1
        sne     qPtr+(qM-1)*(qN+0)+qStep*0 ,qPtr+(qM-1)*(qN+0)+qStep*1
        seq     qPtr+(qM-1)*(qN+0)+qStep*2 ,qPtr+(qM-1)*(qN+0)+qStep*3
qAdec   jmp     qDec ,{qDec
rof
for 1 == 1
        sne     qPtr+(qM+0)*(qN+1)+qStep*0 ,qPtr+(qM+0)*(qN+1)+qStep*1
        seq     qPtr+(qM+0)*(qN+1)+qStep*2 ,qPtr+(qM+0)*(qN+1)+qStep*3
qBinc   jmp     qDec ,>qDec
rof
for 0 == 1
        sne     qPtr+(qM+0)*(qN-1)+qStep*0 ,qPtr+(qM+0)*(qN-1)+qStep*1
        seq     qPtr+(qM+0)*(qN-1)+qStep*2 ,qPtr+(qM+0)*(qN-1)+qStep*3
qBdec   jmp     qDec ,<qDec
rof
for 0 == 1
        sne     qPtr+(qM-1)*(qN-1)+qStep*0 ,qPtr+(qM-1)*(qN-1)+qStep*1
        seq     qPtr+(qM-1)*(qN-1)+qStep*2 ,qPtr+(qM-1)*(qN-1)+qStep*3
qFdec   djn.f   qDec ,qDec
rof
for 0 == 1 && 1 == 1
        sne     qPtr+(qM+2)*(qN+0)+qStep*0 ,qPtr+(qM+2)*(qN+0)+qStep*1
        seq     qPtr+(qM+2)*(qN+0)+qStep*2 ,qPtr+(qM+2)*(qN+0)+qStep*3
        jmp     qAinc ,}qDec
rof
for 0 == 1 && 1 == 1
        sne     qPtr+(qM+1)*(qN+1)+qStep*0 ,qPtr+(qM+1)*(qN+1)+qStep*1
        seq     qPtr+(qM+1)*(qN+1)+qStep*2 ,qPtr+(qM+1)*(qN+1)+qStep*3
        jmp     qBinc ,}qDec
rof
for 1 == 1 && 0 == 1
        sne     qPtr+(qM+1)*(qN-1)+qStep*0 ,qPtr+(qM+1)*(qN-1)+qStep*1
        seq     qPtr+(qM+1)*(qN-1)+qStep*2 ,qPtr+(qM+1)*(qN-1)+qStep*3
        jmp     qBdec ,}qDec
rof
for 1 == 1 && 1 == 1
        sne     qPtr+(qM-2)*(qN+0)+qStep*0 ,qPtr+(qM-2)*(qN+0)+qStep*1
        seq     qPtr+(qM-2)*(qN+0)+qStep*2 ,qPtr+(qM-2)*(qN+0)+qStep*3
        jmp     qAdec ,{qDec
rof
for 0 == 1 && 1 == 1
        sne     qPtr+(qM-1)*(qN+1)+qStep*0 ,qPtr+(qM-1)*(qN+1)+qStep*1
        seq     qPtr+(qM-1)*(qN+1)+qStep*2 ,qPtr+(qM-1)*(qN+1)+qStep*3
        jmp     qBinc ,{qDec
rof
for 1 == 1 && 0 == 1
        sne     qPtr+(qM-2)*(qN-1)+qStep*0 ,qPtr+(qM-2)*(qN-1)+qStep*1
        seq     qPtr+(qM-2)*(qN-1)+qStep*2 ,qPtr+(qM-2)*(qN-1)+qStep*3
        jmp     qFdec ,{qDec
rof
for 1 == 1 && 1 == 1
        sne     qPtr+(qM+0)*(qN+2)+qStep*0 ,qPtr+(qM+0)*(qN+2)+qStep*1
        seq     qPtr+(qM+0)*(qN+2)+qStep*2 ,qPtr+(qM+0)*(qN+2)+qStep*3
        jmp     qBinc ,>qDec
rof
for 0 == 1 && 0 == 1
        sne     qPtr+(qM+0)*(qN-2)+qStep*0 ,qPtr+(qM+0)*(qN-2)+qStep*1
        seq     qPtr+(qM+0)*(qN-2)+qStep*2 ,qPtr+(qM+0)*(qN-2)+qStep*3
        jmp     qBdec ,<qDec
rof
for 0 == 1 && 0 == 1
        sne     qPtr+(qM-1)*(qN-2)+qStep*0 ,qPtr+(qM-1)*(qN-2)+qStep*1
        seq     qPtr+(qM-1)*(qN-2)+qStep*2 ,qPtr+(qM-1)*(qN-2)+qStep*3
        jmp     qFdec ,<qDec
rof
for 0 == 1 && 0 == 1
        sne     qPtr+(qM-2)*(qN-2)+qStep*0 ,qPtr+(qM-2)*(qN-2)+qStep*1
        seq     qPtr+(qM-2)*(qN-2)+qStep*2 ,qPtr+(qM-2)*(qN-2)+qStep*3
        djn.f   qFdec ,qDec
rof
        jmp     bgo	,MARK*5

for MAXLENGTH-CURLINE-13
	dat.f	0	,0
rof

qSteps	dat	qStep*2-1	,qStep*2
qBm	dat	qStep	,}-1
qShfi	dat	qShf	,qShf
qDec	mul.x	#qM	,#qN
	add.f	qDec	,qPtr
	sne	*qPtr	,@qPtr
	add.f	qSteps	,qPtr
qLp	mov	qBm	,*qPtr
	mov	qBm	,@qPtr
qPtr	mov	0	,*qStep
	sub.f	qShfi	,qPtr
	djn.b	qLp	,#qTm
	jmp	bgo	,MARK*5

	end    qGo


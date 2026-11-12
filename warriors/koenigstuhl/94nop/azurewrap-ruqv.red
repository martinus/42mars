;redcode-94nop
;name Azure wrap ruqv
;author Steve Gunnell
;strategy Evolved from markov chained opcodes and random fields
;strategy and wrapped in a Klinesque qscan
;strategy Form ADD JMZ SPL MOV DJN DAT SPL MOV DAT SPL DAT MUL SNE ADD DAT SPL
;assert CORESIZE==8000


qM       equ     6153
qN       equ     6795
qStep    equ     15
qShf	equ	(1+3)
qTm	equ	1+(qStep/qShf)

;null     dat     0,0
null	equ	(qSteps-2)
qSteps  dat     qStep*2-1 ,qStep*2
qBm	dat	qStep	,}-1
qShfi	dat	qShf	,qShf
qDec    mul.x   #qM     ,#qN

        add.f   qDec    ,qPtr
        sne     *qPtr   ,@qPtr
        add.f   qSteps  ,qPtr
qLp	mov	qBm	,*qPtr
	mov	qBm	,@qPtr
qPtr    mov     0       ,*qStep
	sub.f	qShfi	,qPtr
	djn.b	qLp	,#qTm
        jmp     warr

for 39
	dat.f	0	,0
rof

qGo     sne     qPtr+(qM+0)*(qN+0)+qStep*0 ,qPtr+(qM+0)*(qN+0)+qStep*1
        seq     qPtr+(qM+0)*(qN+0)+qStep*2 ,qPtr+(qM+0)*(qN+0)+qStep*3
qJump   jmp     qDec
for 0 == 1
        sne     qPtr+(qM+1)*(qN+0)+qStep*0 ,qPtr+(qM+1)*(qN+0)+qStep*1
        seq     qPtr+(qM+1)*(qN+0)+qStep*2 ,qPtr+(qM+1)*(qN+0)+qStep*3
qAinc   jmp     qDec ,}qDec
rof
for 1 == 1
        sne     qPtr+(qM-1)*(qN+0)+qStep*0 ,qPtr+(qM-1)*(qN+0)+qStep*1
        seq     qPtr+(qM-1)*(qN+0)+qStep*2 ,qPtr+(qM-1)*(qN+0)+qStep*3
qAdec   jmp     qDec ,{qDec
rof
for 0 == 1
        sne     qPtr+(qM+0)*(qN+1)+qStep*0 ,qPtr+(qM+0)*(qN+1)+qStep*1
        seq     qPtr+(qM+0)*(qN+1)+qStep*2 ,qPtr+(qM+0)*(qN+1)+qStep*3
qBinc   jmp     qDec ,>qDec
rof
for 0 == 1
        sne     qPtr+(qM+0)*(qN-1)+qStep*0 ,qPtr+(qM+0)*(qN-1)+qStep*1
        seq     qPtr+(qM+0)*(qN-1)+qStep*2 ,qPtr+(qM+0)*(qN-1)+qStep*3
qBdec   jmp     qDec ,<qDec
rof
for 1 == 1
        sne     qPtr+(qM-1)*(qN-1)+qStep*0 ,qPtr+(qM-1)*(qN-1)+qStep*1
        seq     qPtr+(qM-1)*(qN-1)+qStep*2 ,qPtr+(qM-1)*(qN-1)+qStep*3
qFdec   djn.f   qDec ,qDec
rof
for 0 == 1 && 0 == 1
        sne     qPtr+(qM+2)*(qN+0)+qStep*0 ,qPtr+(qM+2)*(qN+0)+qStep*1
        seq     qPtr+(qM+2)*(qN+0)+qStep*2 ,qPtr+(qM+2)*(qN+0)+qStep*3
        jmp     qAinc ,}qDec
rof
for 0 == 1 && 0 == 1
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
for 0 == 1 && 0 == 1
        sne     qPtr+(qM-1)*(qN+1)+qStep*0 ,qPtr+(qM-1)*(qN+1)+qStep*1
        seq     qPtr+(qM-1)*(qN+1)+qStep*2 ,qPtr+(qM-1)*(qN+1)+qStep*3
        jmp     qBinc ,{qDec
rof
for 0 == 1 && 1 == 1
        sne     qPtr+(qM-2)*(qN-1)+qStep*0 ,qPtr+(qM-2)*(qN-1)+qStep*1
        seq     qPtr+(qM-2)*(qN-1)+qStep*2 ,qPtr+(qM-2)*(qN-1)+qStep*3
        jmp     qFdec ,{qDec
rof
for 1 == 1 && 0 == 1
        sne     qPtr+(qM+0)*(qN+2)+qStep*0 ,qPtr+(qM+0)*(qN+2)+qStep*1
        seq     qPtr+(qM+0)*(qN+2)+qStep*2 ,qPtr+(qM+0)*(qN+2)+qStep*3
        jmp     qBinc ,>qDec
rof
for 1 == 1 && 0 == 1
        sne     qPtr+(qM+0)*(qN-2)+qStep*0 ,qPtr+(qM+0)*(qN-2)+qStep*1
        seq     qPtr+(qM+0)*(qN-2)+qStep*2 ,qPtr+(qM+0)*(qN-2)+qStep*3
        jmp     qBdec ,<qDec
rof
for 1 == 1 && 1 == 1
        sne     qPtr+(qM-1)*(qN-2)+qStep*0 ,qPtr+(qM-1)*(qN-2)+qStep*1
        seq     qPtr+(qM-1)*(qN-2)+qStep*2 ,qPtr+(qM-1)*(qN-2)+qStep*3
        jmp     qFdec ,<qDec
rof
for 0 == 1 && 1 == 1
        sne     qPtr+(qM-2)*(qN-2)+qStep*0 ,qPtr+(qM-2)*(qN-2)+qStep*1
        seq     qPtr+(qM-2)*(qN-2)+qStep*2 ,qPtr+(qM-2)*(qN-2)+qStep*3
        djn.f   qFdec ,qDec
rof
;        jmp     warr

warr	spl	1	,L00+6+0+0
	mov.i	<warr	,<throw
	mov.i	<warr	,<throw
	mov.i	<warr	,<throw
for 0
	mov.i	<warr	,<throw
rof
	djn.b	@throw	,#1
	sub	throw	,throw
throw	dat	}4000	,}1936

for 0
	dat.f	0	,0
rof

GATE	equ	(L00-36)
IMP	equ	7579

L00	ADD.AB	$2	,#2731/6
L01	JMZ.F	$-1	,@-1
L02	SPL.F	#L12	,$L13
L03	MOV.I	*-3	,>-3
L04	DJN.F	$-1	,{-710
L05	DAT.F	$0	,$0
L06	SPL.F	#684	,>684
L07	MOV.AB	#0	,{0
L08	DAT.F	$0	,$0
L09	SPL.F	#-2312	,>-2312
L10	DAT.F	$0	,$0
L11	MUL.B	*1034/16	,$L03
L12	SNE.I	{L00	,@48/16
L13	ADD.B	$L15	,$1820/16
L14	DAT.F	$0	,$0
L15	SPL.F	#0	,{2057

	end	qGo


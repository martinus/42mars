;redcode-94nop
;name Consequence kjlr
;author Steve Gunnell
;strategy variable slowqscan -> evolved oneshot
;strategy Elaborating a warrior created by the azure evolver
;assert CORESIZE==8000


qM       equ     7087
qN       equ     5775
qStep    equ     35
qShf	equ	(1+9)
qTm	equ	1+(qStep/qShf)

null	equ	(qSteps-2)
qSteps  dat     qStep*2-1 ,qStep*2
qBm	jmp	#qStep	,<0
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
        jmp     warr	,}4000

for 39
	dat.f	0	,0
rof

qGo     sne     qPtr+(qM+0)*(qN+0)+qStep*0 ,qPtr+(qM+0)*(qN+0)+qStep*1
        seq     qPtr+(qM+0)*(qN+0)+qStep*2 ,qPtr+(qM+0)*(qN+0)+qStep*3
qJump   jmp     qDec
for 1 == 1
        sne     qPtr+(qM+1)*(qN+0)+qStep*0 ,qPtr+(qM+1)*(qN+0)+qStep*1
        seq     qPtr+(qM+1)*(qN+0)+qStep*2 ,qPtr+(qM+1)*(qN+0)+qStep*3
qAinc   jmp     qDec ,}qDec
rof
for 0 == 1
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
for 1 == 1
        sne     qPtr+(qM+2)*(qN+0)+qStep*0 ,qPtr+(qM+2)*(qN+0)+qStep*1
        seq     qPtr+(qM+2)*(qN+0)+qStep*2 ,qPtr+(qM+2)*(qN+0)+qStep*3
        jmp     qAinc ,}qDec
rof
for 1 == 1
        sne     qPtr+(qM+1)*(qN+1)+qStep*0 ,qPtr+(qM+1)*(qN+1)+qStep*1
        seq     qPtr+(qM+1)*(qN+1)+qStep*2 ,qPtr+(qM+1)*(qN+1)+qStep*3
        jmp     qBinc ,}qDec
rof
for 0 == 1
        sne     qPtr+(qM+1)*(qN-1)+qStep*0 ,qPtr+(qM+1)*(qN-1)+qStep*1
        seq     qPtr+(qM+1)*(qN-1)+qStep*2 ,qPtr+(qM+1)*(qN-1)+qStep*3
        jmp     qBdec ,}qDec
rof
for 0 == 1
        sne     qPtr+(qM-2)*(qN+0)+qStep*0 ,qPtr+(qM-2)*(qN+0)+qStep*1
        seq     qPtr+(qM-2)*(qN+0)+qStep*2 ,qPtr+(qM-2)*(qN+0)+qStep*3
        jmp     qAdec ,{qDec
rof
for 1 == 1
        sne     qPtr+(qM-1)*(qN+1)+qStep*0 ,qPtr+(qM-1)*(qN+1)+qStep*1
        seq     qPtr+(qM-1)*(qN+1)+qStep*2 ,qPtr+(qM-1)*(qN+1)+qStep*3
        jmp     qBinc ,{qDec
rof
for 0 == 1
        sne     qPtr+(qM-2)*(qN-1)+qStep*0 ,qPtr+(qM-2)*(qN-1)+qStep*1
        seq     qPtr+(qM-2)*(qN-1)+qStep*2 ,qPtr+(qM-2)*(qN-1)+qStep*3
        jmp     qFdec ,{qDec
rof
for 1 == 1
        sne     qPtr+(qM+0)*(qN+2)+qStep*0 ,qPtr+(qM+0)*(qN+2)+qStep*1
        seq     qPtr+(qM+0)*(qN+2)+qStep*2 ,qPtr+(qM+0)*(qN+2)+qStep*3
        jmp     qBinc ,>qDec
rof
for 0 == 1
        sne     qPtr+(qM+0)*(qN-2)+qStep*0 ,qPtr+(qM+0)*(qN-2)+qStep*1
        seq     qPtr+(qM+0)*(qN-2)+qStep*2 ,qPtr+(qM+0)*(qN-2)+qStep*3
        jmp     qBdec ,<qDec
rof
for 0 == 1
        sne     qPtr+(qM-1)*(qN-2)+qStep*0 ,qPtr+(qM-1)*(qN-2)+qStep*1
        seq     qPtr+(qM-1)*(qN-2)+qStep*2 ,qPtr+(qM-1)*(qN-2)+qStep*3
        jmp     qFdec ,<qDec
rof
for 0 == 1
        sne     qPtr+(qM-2)*(qN-2)+qStep*0 ,qPtr+(qM-2)*(qN-2)+qStep*1
        seq     qPtr+(qM-2)*(qN-2)+qStep*2 ,qPtr+(qM-2)*(qN-2)+qStep*3
        djn.f   qFdec ,qDec
rof

warr	mov.i	<src	,<throw
src	spl	1	,L00+5
	mov.i	<src	,<throw
	mov.i	<src	,<throw
	djn.b	@throw	,#1
	sub.b	throw	,throw
throw	dat	}4000	,3299

for 7
	dat.f	0	,0
rof

L00	ADD.AB	L02	,#2
L01	JMZ.F	L00	,@L00
L02	SPL.F	#10	,14
L03	MOV.I	*L00	,>L00
for 0
	MOV.I	*L00	,>L00
rof
L04	DJN.F	L03	,<7899

	end	qGo


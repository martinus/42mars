;redcode-94nop
;name Alternating Raisins B lsxd
;author Steve Gunnell
;strategy Do a qscan then one of two semi evolved components
;strategy Looks like a
;strategy Based on shapeshifter, Paul Kline Qscan.
;assert CORESIZE==8000

;kill Alternating Raisins
;password bjpjnahgjy

; post bomb component
B0:
; Block 126 source azure-qpbc.red 
	DIV.AB	#1	,#-31
	SPL.F 	#1468	,$-32
	MOV.I 	*-2	,<3
	MOV.I 	*-3	,<2
	DJN.F 	$-2	,}-3
	DAT.F 	$3	,$-2264
	MOV.I 	>-1	,>0
	SPL.F 	@-2	,}175
	MOV.I 	#0	,$0
	MOV.I 	}0	,<-1500
	MOV.I 	{2400	,}657
	DJN.F 	@-2	,}-1

G0	equ	0
G1	equ	0
G2	equ	3

for G0
	dat.f	0	,0
rof

qM       equ     5732
qN       equ     561
qStep    equ     67
qShf	equ	(1+4)
qTm	equ	(qStep/qShf)+7

null	equ	(B0-2)
qSteps  dat     qStep*2-1 ,qStep*2
qBm	spl	qStep	,#0
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
        jmp     boot2	,}4000

for G1
	dat.f	0	,0
rof

qGo     sne     qPtr+(qM+0)*(qN+0)+qStep*0 ,qPtr+(qM+0)*(qN+0)+qStep*1
        seq     qPtr+(qM+0)*(qN+0)+qStep*2 ,qPtr+(qM+0)*(qN+0)+qStep*3
qJump   jmp     qDec
for 0 + 0 > 0
        sne     qPtr+(qM+1)*(qN+0)+qStep*0 ,qPtr+(qM+1)*(qN+0)+qStep*1
        seq     qPtr+(qM+1)*(qN+0)+qStep*2 ,qPtr+(qM+1)*(qN+0)+qStep*3
qAinc   jmp     qDec ,}qDec
rof
for 0 + 0 > 0
        sne     qPtr+(qM-1)*(qN+0)+qStep*0 ,qPtr+(qM-1)*(qN+0)+qStep*1
        seq     qPtr+(qM-1)*(qN+0)+qStep*2 ,qPtr+(qM-1)*(qN+0)+qStep*3
qAdec   jmp     qDec ,{qDec
rof
for 0 + 0 + 0 + 0 > 0
        sne     qPtr+(qM+0)*(qN+1)+qStep*0 ,qPtr+(qM+0)*(qN+1)+qStep*1
        seq     qPtr+(qM+0)*(qN+1)+qStep*2 ,qPtr+(qM+0)*(qN+1)+qStep*3
qBinc   jmp     qDec ,>qDec
rof
for 0 + 1 + 1 > 0
        sne     qPtr+(qM+0)*(qN-1)+qStep*0 ,qPtr+(qM+0)*(qN-1)+qStep*1
        seq     qPtr+(qM+0)*(qN-1)+qStep*2 ,qPtr+(qM+0)*(qN-1)+qStep*3
qBdec   jmp     qDec ,<qDec
rof
for 0 + 0 + 0 + 0 > 0
        sne     qPtr+(qM-1)*(qN-1)+qStep*0 ,qPtr+(qM-1)*(qN-1)+qStep*1
        seq     qPtr+(qM-1)*(qN-1)+qStep*2 ,qPtr+(qM-1)*(qN-1)+qStep*3
qFdec   djn.f   qDec ,qDec
rof
for 0 == 1
        sne     qPtr+(qM+2)*(qN+0)+qStep*0 ,qPtr+(qM+2)*(qN+0)+qStep*1
        seq     qPtr+(qM+2)*(qN+0)+qStep*2 ,qPtr+(qM+2)*(qN+0)+qStep*3
        jmp     qAinc ,}qDec
rof
for 0 == 1
        sne     qPtr+(qM+1)*(qN+1)+qStep*0 ,qPtr+(qM+1)*(qN+1)+qStep*1
        seq     qPtr+(qM+1)*(qN+1)+qStep*2 ,qPtr+(qM+1)*(qN+1)+qStep*3
        jmp     qBinc ,}qDec
rof
for 1 == 1
        sne     qPtr+(qM+1)*(qN-1)+qStep*0 ,qPtr+(qM+1)*(qN-1)+qStep*1
        seq     qPtr+(qM+1)*(qN-1)+qStep*2 ,qPtr+(qM+1)*(qN-1)+qStep*3
        jmp     qBdec ,}qDec
rof
for 0 == 1
        sne     qPtr+(qM-2)*(qN+0)+qStep*0 ,qPtr+(qM-2)*(qN+0)+qStep*1
        seq     qPtr+(qM-2)*(qN+0)+qStep*2 ,qPtr+(qM-2)*(qN+0)+qStep*3
        jmp     qAdec ,{qDec
rof
for 0 == 1
        sne     qPtr+(qM-1)*(qN+1)+qStep*0 ,qPtr+(qM-1)*(qN+1)+qStep*1
        seq     qPtr+(qM-1)*(qN+1)+qStep*2 ,qPtr+(qM-1)*(qN+1)+qStep*3
        jmp     qBinc ,{qDec
rof
for 0 == 1
        sne     qPtr+(qM-2)*(qN-1)+qStep*0 ,qPtr+(qM-2)*(qN-1)+qStep*1
        seq     qPtr+(qM-2)*(qN-1)+qStep*2 ,qPtr+(qM-2)*(qN-1)+qStep*3
        jmp     qFdec ,{qDec
rof
for 0 == 1
        sne     qPtr+(qM+0)*(qN+2)+qStep*0 ,qPtr+(qM+0)*(qN+2)+qStep*1
        seq     qPtr+(qM+0)*(qN+2)+qStep*2 ,qPtr+(qM+0)*(qN+2)+qStep*3
        jmp     qBinc ,>qDec
rof
for 1 == 1
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

	add.f	adju	,dest
boot2:	spl	1	,<4000
	mov.i	<dest	,{dest
	mov.i	<dest	,{dest
	mov.i	<dest	,{dest
	mov.i	<dest	,{dest
	mov.i	<dest	,{dest
	mov.i	<dest	,{dest
	djn.b	*1	,#1
dest	div.f	#1323	,#B0+12
adju	dat	#3824	,A0-B0


for G2
	dat.f	0	,0
rof

; Second component
A0:
; Block 108 source altraisins-sbly.red 
	SPL.F 	#-3707	,#-3706
	SUB.AB	#-588	,$1
	MOV.I 	$7	,*3926
	MOV.I 	$-3	,@-1
	JMZ.B 	$-3	,#0
	MOV.I 	$2	,>-12
	DJN.F 	$-1	,>-13
	DAT.F 	<2667	,$16
	DAT.F 	$0	,$0
	MOV.I 	$3707	,>3707
	DAT.F	$0	,$0
	DAT.F	$0	,$0

	end	qGo


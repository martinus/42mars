;redcode-94nop
;name He Scans Alone qhoz
;author P.Kline
;strategy 80% f-scanner switches from SPL to DAT carpet
;strategy Tweaked and upcycled by Steve G
;assert CORESIZE == 8000


STEP	equ	10
TIME	equ	19
OFFSET	equ	2813

tPtr	dat	100	,OFFSET	; widely-spaced pointers
	dat	0	,0
for	3
	dat	0	,0
rof

tWipe	mov	tSpl	,<tPtr	; positive wipe of opponent
	mov	>tPtr	,>tPtr
	jmn.f	tWipe	,>tPtr

tScan	sub.x	#0-STEP	,tPtr	; increment and look
	sne	*tPtr	,@tPtr
	sub.x	*pScan	,@tScan	; increment and look
	jmn.f	tSelf	,@tPtr
	jmz.f	tScan	,*tPtr
pScan	mov.x	@tScan	,@tScan	; swap pointers for attack
tSelf	slt.b	@tScan	,#tEnd+4-tPtr	; self-check
	djn	tWipe	,@tScan	; go to attack
	djn	*pScan	,#TIME	; after 19 self-scans
	jmp	*pScan	,}tWipe	;	switch to dat-wiping
	dat	0	,0
tSpl	spl	#1	,{1
	dat	0	,0
	dat	0	,0
tEnd	dat	0	,0

for	MAXLENGTH-CURLINE-2-1
	dat	0	,0
rof

;tDecoy	equ	(tWipe+7007)
;tStart	mov	<tDecoy+0	,{tDecoy+2	; make a quick-decoy
;	mov	<tDecoy+3	,{tDecoy+5	; to foil one-shots
;	mov	<tDecoy+6	,{tDecoy+8	; and the occasional q-scan
;	djn.f	tScan+1	,<tDecoy+10

B	equ	(tWipe+7007)

tStart	mov.i	<B	,{B+3
I for	1
	mov.i	<B+1+(3*I)	,{(B+(3*I)+3)
  rof
	djn.f	tScan+1	,<B+5+(3*1)

	end	tStart


;redcode
;name Tangle Trap 3 dlhu
;author David Moore
;strategy .4c pit trapper with error-checking.
;strategy If damaged, then deploy "airbag"
;strategy tweaked and upcycled by Steve G
;assert CORESIZE==8000

; vamp numbers

step	equ	6935
skip	equ	(0-11)
time	equ	570

; boot distances

dist	equ	4429	; distance to vamp_A from boot
distCh	equ	14	; distance to check from vamp_A
distT	equ	123	; distance to trap from vamp_A
distCl	equ	(0-72)	; distance to clear from vamp_A

MARK	equ	4405

boot2	mov	clBomb	,@pCl
	mov	fang2	,@pF
	mov	fang1	,<pF
pW	mov	wimp	,boot+dist+(vamp_C-vamp_A)+skip+step
pT	spl	pC	,boot+dist+distT+3
pF	spl	boot+dist+2	,boot+dist+distCh
pV	spl	@0	,boot+dist+6
	mov	<pV	,pF	; hide boot pointers
	dat	<pT	,<pW

pC	spl	boot+dist+3	,boot+dist+distCl+3
pV2	spl	@0	,boot+dist+1
	mov	<pV2	,pC	; hide boot pointers
	dat	<pV2	,<boot+dist+5421

boot	spl	boot2	,<boot+dist+MARK
	spl	2	,<boot+dist+MARK*2
	spl	1	,<boot+dist+MARK*3
	mov	<source	,<pV
	mov	<source	,<pV
	mov	<source	,<pC
	mov	<source	,<pT
	djn	@pV2	,#3
pCl	djn	@pV	,#boot+dist+distCl-4

wimp	jmp	0	,<0
clBomb	dat	<-8	,#-10

fang1	jmp	skip + step	,skip
fang2	jmp	distT-(vamp_C-vamp_A)+(step*time)-skip-step	,2

	spl	0	,<2
source	spl	-1	,vamp_A + 6
	jmn	-1	,#MAXPROCESSES

	spl	0	,<-7
	mov	-5	,<-5
	djn	-1	,<5359

check	equ	(vamp_A + distCh)
clear	equ	(vamp_A + distCl)

vamp_A	add	vamp_B	,check
vamp_B	sub	#-step	,2
vamp_C	mov	<check	,@vamp_D
vamp_D	mov	<check	,@vamp_C - step * time
vamp_E	jmz	vamp_A	,check
	jmp	clear	,0

end boot


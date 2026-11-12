;redcode-94-nop
;name RecursFact
;author Fab
;strategy Try Redcode : NOT A WARRIOR.
;strategy Test call/ret/push/pop stack.
;strategy Use recursivity to test reentrance.
;assert 1

	org	fRecurs

dum	equ	123

;***************************************
; This stack increases downside.
; There is no interrupt (and no way to
; automatically preserve context). So we
; can securely modify stack pointer.
; Use "bp" register like 80x86 to manage
; stack parameters.

bpSp	dat	#dum, #bpSp		; bp, sp :=0

;***************************************
; * Abstract :
;   Computes Cnp = n!/p!/(n-p)!.
;   Uses recursion formula of Pascal
;   triangle :
;   if p==0||p==n return 1
;   else return Cnp(n-1, p-1)+Cnp(n-1, p)
;
; * Input :    n, p @stack-1.
; * Output : Cnp(n) @stack-1.B.
; * Return address : on stack.
_np	equ	1

Cnp
pushB	mov.ab	bpSp, <bpSp		; Push bp.
pushN	equ	(pushE-pushB)
pushE
	mov.ba	bpSp, bpSp		; bp :=sp
	add.a	#(_np+pushN), bpSp	; @bp : np.
	jmz	retOne, *bpSp		; n == 0 ?
	sne.ab	*bpSp, *bpSp		; n == p ?
	jmp	retOne

	sub.a	#1, *bpSp		; n :=n-1.
	mov.f	*bpSp, <bpSp		; Push n-1, p.
 	mov	#(back1-CnpRet), <bpSp	; Call Cnp(n-1, p).
	jmp	Cnp
back1					; Keep result on stack.
	sub.ab	#1, *bpSp		; p :=p-1.
	mov.f	*bpSp, <bpSp		; Push n-1, p-1.
 	mov	#(back2-CnpRet), <bpSp	; Call Cnp(n-1, p-1).
	jmp	Cnp
back2
	mov.b	>bpSp, *bpSp		; pop result.B
	add.b	>bpSp, *bpSp		; + pop old Cnp(n-1, p).

ej	mov.ba	>bpSp, bpSp		; Pop bp.
	mov.b	>bpSp, CnpRet		; Returns.
CnpRet	jmp	@CnpRet, #dum

retOne	mov	#1, *bpSp		; Result is 1.
	jmp	ej

;***************************************
; Entry.

fRecurs	mov.f	np, <bpSp		; Push np.
	mov	#(back3-CnpRet), <bpSp	; Call Cnp(n, p).
	jmp	Cnp
back3
	mov.b	>bpSp, result		; Pop Cnp.

;***************************************

result	dat	#dum, #dum		; .B : Cnp to be computed.
np	dat	#11, #5			; n, p.

	end


;redcode-94nop
;name Jedi Hunter
;author M Joonas Pihlaja
;strategy scan -> clear
;assert 1
; KOFACOTO-1

load0 z for 0
	rof
datzero	equ	(load0-1)
	org 	start

; Only dat <1,* bombs can decoy us, but they aren't in core until it's
; too late.

; constants
TSTEP	equ	1751			; paper copy step
BOOT	equ	1404			; ofs from start of RotJ.
TGTLEN	equ	55			; qscan portion length.
SCAN_GO	equ	MAXLENGTH+TGTLEN-1	; first scan location.


	; Find qscan body.
scan	add.ba	#load0+SCAN_GO,#TGTLEN	; faster is bigger, not better.
start	jmz.f	-1,	*scan

	; Find start.
	sub.a	#9,	scan		; rough scan for start.
	jmn.f	-1,	*scan
	jmz.f	#0,	}scan		; make precise.
	djn.a	scan,	{scan		; foil decoy. (look for qbomb's `1'.)

	; Disable boot in case RotJ hasn't booted yet. (~20 more points!)
	mov	scan,	scan+92		; bomb first word of unbooted
	mov	datzero,*scan+92	; paper (most reliable).

	; Spl/jmp bomb paper modules.
	add.ab	scan,	bp
loop	mov	bspl,	@bp
bp	mov	bjmp,	*scan+BOOT+1
	add	#TSTEP,	bp
	jmn.f	loop,	@bp

	; Wipe stunned paper and the odd imp.
gate	equ	(load0-3)
bspl
wipe	spl	#2,	{gate		; {gate clears RotJ dat <1,* bomb
	mov	2,	}gate		; in case it falls on gate.
	djn.f	-1,	}gate
	dat	2-gate,	}1143

z for MAXLENGTH-CURLINE-1
  dat 0,0
  rof

bjmp	jmp	-2,	{-1		; {-1 messes up imp step of evoli.
	end


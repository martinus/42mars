;redcode
;name DTMbB 
; [Don't Touch My (big) Brother!]
;author Zul Nadzri
;strategy Stun the bully and save big brother
;strategy Tournament Round 17 
;strategy Plan #1
;assert 1

; ver 12 - rearrange code + cleanup

;------------------------------- Initial -------------------------------
ptr1 equ 200+5-100				;first point of scan
incr1 equ 67
adj equ 3						;adjust seek to top transfer

;--------------------- Main Program: Begin at 'seek' --------------------
aaa	dat 0,0
eye 	dat #adj, #adj
tmp	dat 0,0
incr	dat #incr1, #-incr1

top	add incr, seek				;incrementing...
seek	sne ptr1, -ptr1				;compare cores
flag	jmp top, <-8				;return and repeat cycle

pick	mov.i seek, tmp				;put a-location to operation table
	add eye, tmp				;adjust relative position
	sne aaa, *tmp				;compare with zero
bfac	mov.ba tmp, tmp				;put b-location to operation table
afac	jmn.f 0, }tmp				;scan for end of the line
	add.a #-2, tmp				;readjust to end of line

grab	sne.i little, *tmp			;check for Little
	jmp sika					;found LITTLE
	seq.i trace, *tmp				;check for Little's djn stream
	jmp color					;found LITTLE'S DJN STREAM (TRACER)

trak	sub.a #4, tmp				;find top of stream for calibration
	jmn.a trak, *tmp				;repeat until top is found
	sub.a #1599, tmp				;point vamp to little's location
sika	sub.a tmp, jumper				;set 'vamp' location to top of Little
	mov clear, }tmp				;send out vamp
	mov clear, }tmp				;send out vamp
	mov jumper, }tmp				;send our vamp
	mov stun1, afac+1				;(erase if not needed)
	spl buddy7, }aaa-1
jumper7 jmp buddyb7, #4000			;dclear pointer
dat 0
jumper jmp tap-tmp-4, #2000			;the Vamp and its jump location

color	add.a #-7, tmp				;adjust to top of the line
	add.ab #7, 2 				;request for 7 core stun
	mov stun1, }tmp				;stun Color
	djn -1, #0					;stun Color
	mov stun2, }tmp				;add jmp to Color's end of line
	jmp top, }aaa-2				;continue scanning [todo: consider adding spl]
dat 0,0
;-------------------------- buddy's code 1 : backward scan, backward clear ----
	nop 0,0
clear	nop 0,0	
tap	spl buddyb
bud1	add #8, 1
buddy jmz.f -1, zzz+1				;start avoiding 2nd group
	mov stun1, <buddy
	mov >buddy, >buddy
	jmn.f -2, >buddy
	jmn.f bud1, bfac				;end before self-hit
	mov clear7, bud7
stun1	spl #0, #0
	mov cpt, >jumper
	djn.f -1,>jumper 
cpt	dat <1471,bully-jumper
;-------------------------- Master code 1 : backward scan, backward clear -----
clear7 jmp 7, 7	
tap7	spl buddyb7, }aaa-3
bud7	add #8, 1 
buddy7 jmz.f -1, zzz+1+4000-50+3		;start from center
	mov stun7, <buddy7
	mov >buddy7, >buddy7
	jmn.f -2, >buddy7
	jmn.f bud7, bfac				;end before self-hit
	mov clear7, bud1b
stun7	spl #0, #0
	mov cpt7, >jumper7
	djn.f -1,>jumper7
cpt7	dat <1471,bully-jumper7

;-------------------------- buddy's code 2 : forward scan, forward clear----
bud1b	add #-8, 1 
buddyb jmz.f -1, aaa-1				;starts avoiding first group
	mov stun1, <buddyb
	mov >buddyb, >buddyb
	jmn.f -2, >buddyb
	jmn.f bud1b, zzz				;and ends before self-hit
	mov clear7, bud1b7
	spl stun1
save2	jmp 0						;go to silence during dclear
stun2 jmp -1, 0

;-------------------------- Master code 2 : forward scan, forward clear -----
bud1b7	add #-8, 1 
buddyb7 jmz.f -1, aaa-1-4000+50-2		;starts avoiding first group
	mov stun1, <buddyb7
	mov >buddyb7, >buddyb7
	jmn.f -2, >buddyb7
	jmn.f bud1b7, zzz				;and ends before self-hit
	mov clear7, bud1
	spl stun7, }aaa-4
save2b	jmp 0					;go to silence during dclear

for 5
dat 0
rof
;-------------------------- signitures of target warriors ------------------
bully	djn.b $-2, <2335
little jmp.b $2, }-2
trace	dat.f $-1, $0

;------------------------------ end game switch ----------------------------
	dat 1,1
	dat 1,1
	dat 1,1
	dat 1,1
trail	dat 1,1
zzz	dat 1,1

;-------------------------- end of program ---------------------------------
;end buddy
end seek
;end tap
;end tap7

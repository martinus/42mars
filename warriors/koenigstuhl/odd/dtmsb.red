;redcode
;name DTMsB 
; [Don't Touch My (small/little) Brother!]
;author Zul Nadzri
;strategy Save little brother quickly and then together hit the bully
;strategy Tournament Round 17 
;strategy Plan #2
;assert 1

ptr1 equ 200+5					;first point of scan
incr1 equ 79
incr2 equ -incr1
adj equ 3						;adjust seek to top transfer

;--------------------- normal scan, start at 'seek' -------------
aaa	dat 1,1

for 10 
dat 1, 1
rof

trailc dat 1,1
kl	nop 0,0
adjust dat #adj, #adj
tmp	dat 0,0
incr	dat #incr1, #incr2
top	add incr, seek	
seek	sne ptr1, -ptr1

flag	jmp top, <-8				;recycle
	mov.i seek, tmp				;put a-location to operation table
	add adjust, tmp				;adjust relative position
	sne aaa-5, *tmp				;compare with zero

trailb mov.ba tmp, tmp				;put b-location to operation table

afield jmn.f 0, }tmp				;scan for end of the line
	add.a #-2, tmp				;readjust to end of line
	sne.i little, *tmp			;check for Little
	jmp sika, 10				;found LITTLE
	seq.i trace, *tmp				;check for Little's djn stream
jumper7 jmp top					;found COLOR..and skip it!

tracer sub.a #4, tmp				;find top of Tracer for calibration
	jmn.a tracer, *tmp			;repeat until top is found
	sub.a #1599, tmp				;calibrate relative to our position
sika	sub.a tmp, jumper				;set 'vamp' location to top of Little
	mov kl, }tmp				;send out vamp
	mov kl, }tmp				;send out vamp
	mov jumper, }tmp				;send our vamp
tap7	spl buddy7, }aaa-1
	jmp buddyb7, }aaa-2
jumper jmp tap-tmp-3, 50			;the Vamp

;-------------------------- Common variables ----------------------------------
sken1 equ 14
sken2 equ 8

;-------------------------- buddy's code 1 : backward scan, backward clear ----
clear7	nop 0,0		
tap	spl buddyb, }aaa-3
bud1	add #sken1, 1
buddy jmz.f -1, zzz+1				;start avoiding 2nd group
	mov stun1, <buddy
	mov >buddy, >buddy
	jmn.f -2, >buddy
	jmn.f bud1, trailc			;end before self-hit
	mov clear, bud7
	spl klue
stun1	spl #0, #0
	mov cpt, >jumper
	djn.f -1,>jumper 
cpt	dat -45, 45

;-------------------------- Master code 1 : backward scan, backward clear -----
clear	jmp 7,7
bud7	add #sken2, 1 
buddy7 jmz.f -1, zzz+1+4000-50+9		;start from center
	mov stun7, <buddy7
	mov >buddy7, >buddy7
	jmn.f -2, >buddy7
	jmn.f bud7, trailc			;end before self-hit
init2	mov clear, bud1b
	spl klue2
stun7	spl #0, #0
	mov cpt7, {hit
	djn.f -1, {hit
cpt7	dat -55,45

;-------------------------- buddy's code 2 : forward scan, forward clear----
bud1b	add #-sken1, 1 
buddyb jmz.f -1, aaa-1-5-12			;starts avoiding first group
	mov stun1, <buddyb
	mov >buddyb, >buddyb
	jmn.f -2, >buddyb
	jmn.f bud1b, zzz				;and ends before self-hit
	mov clear, bud1b7
klue	spl stun1
save2	jmp 0						;go to silent during dclear
stun2 jmp -1, 0

;-------------------------- Master code 2 : forward scan, forward clear -----
bud1b7	add #-sken2, 1 
buddyb7 jmz.f -1, aaa-1-4000+50-10		;starts avoiding first group
	mov stun1, <buddyb7
	mov >buddyb7, >buddyb7
	jmn.f -2, >buddyb7
	jmn.f bud1b7, zzz				;and ends before self-hit
	mov clear, bud1
klue2	spl stun7
save2b	jmp 0					;go to silent during dclear

;-------------------------- signitures of target warriors ------------------
hit dat -45, 45

for 3
dat 1,1
rof

bully	djn.b $-2, <2335
little jmp.b $2, }-2
trace	dat.f $-1, $0
	dat 1,1
	dat 1,1
	dat 1,1
trail	dat 1,1
zzz	dat 1,1

for 3
dat 1,1
rof

end seek


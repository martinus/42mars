;redcode-94
;name Mem^3
;author G.Labarga
;assert CORESIZE==8000 && PSPACESIZE>0
;strategy MiniChallenge#6, entry 1
;strategy Expanded addaptative switcher
;strategy Anti-adaptative capability added

; It tries to compensate the lack of patience of the addaptative switcher
; Saves in p-space a table with the switch to do after every three consecutive results
; Better score against table-based switchers

;ver 2: It can switch to anti-addaptative mode :)

;	TO-DO table: cell=473+(9*prev2)+(3*prev)+result
;	473: l l l	;after three consecutive loses
;	474: l l w	;after two consecutive loses and a win
;	475: l l t	;after two consecutive loses and a tie
;	476: l t l	;...
;	477: l t w
;	478: l t t
;	479: l w l
;	480: l w w
;	481: l w t
;	...
;	499: t t t
; like if they were bits, but three-valued bits :)
; so 3^3=27 locations for the table

pin 211
	p_last equ 470		;last table cell used
	p_prev equ 469		;previous result
	p_prev2 equ 468		;result two rounds before
	p_strat equ 467		;last strategy
	p_leader equ 111	;leader flag location
	c_leader equ 99		;leader flag value
	p_ctr equ 13		;round counter
	p_manyw equ 18		;number of wins
	p_mode equ 117		;anti-addaptative mode flag

start:
result:	stp.ab #c_leader,#p_leader	;set "leader" flag
	ldp.a #0,result
	ldp.a #p_prev,prev
	ldp.ab #p_prev2,prev
	ldp.ab #p_last,last
	ldp.a #p_strat,go

	jmz.f init,*result	;initialize on first round

rounds:	ldp.ab #p_ctr,#0	;------ anti-adap. mode check
mwins:	ldp.ab #p_manyw,#0
	add.ba rounds,incr
	mov.b rounds,1
	mod.ab #300,#0		;check every 300 rounds
	jmn.b incr,-1
r3:	div.ab #2,rounds	; 50% rounds
smode:	ldp.ab #p_mode,#0
toggle:	sub.b smode,#1
	slt.b rounds,mwins	;if wins<50% rounds...
	stp.b toggle,#p_mode 	;switches to anti-addaptative mode, (evertweaking variables)

incr:	stp.ab #1,#p_ctr	;increment counters
	sne.a #1,result
	add.ab #1,mwins
	stp.b mwins,#p_manyw	;----

	ldp.ab #p_mode,#0
	jmz.b 2,-1		;check a-a flag
	mov.a #0,result 	;<- this kills addaptative excellent!

lstr:	ldp.b last,#0		;tweak last variable used
mdfy:	sub.ab result,#1	;[ +1 on loss ]
	add.b mdfy,lstr		;| +0 on win  |
last:	stp.b lstr,#0		;[ -1 on tie  ]

calc:	add.ab *prev,addr	;claculate wich variable to use depending previous results
	add.b @prev,addr
	add.ab result,addr
slct:	ldp.b addr,#0		;<- switch to do
	add.ba slct,go
	mod.a #3,go
	stp.b addr,#p_last
	stp.ab prev,#p_prev2	;prev->prev2
	stp.ab result,#p_prev	;result->prev
	stp.ab go,#p_strat	;save strat

go:	jmn @0,clear		;execute strat
	jmp @0,gate		;(\no need to use jmn already)
	jmp @0,imp

init:	stp.ab #1,#p_ctr	;set round counter to 1
iloop:	stp.a #1,pptr		;initialize memory table...
	stp.ab #2,pptr		;...as a single addaptative
	add.f #3,3
	djn.b iloop,#9
	jmp clear		;execute clear on first round
pptr:	dat 473,475

addr:	dat #0,#473		;table origin
prev:	dat #0,#0		;here are prev*3,prev2*9 calculated. Faster than MUL
	dat #3,#9
	dat #6,#18
;-------------------------------[ strategies ]----------------------
for 10
	dat 0,0
rof
	ptr equ clear-3

clear:	mov bmb,}ptr
	mov bmb,}ptr
	jmp -2
bmb:	dat 7,0
for 5
	dat 0,0
rof
gate:	jmp #0,<-3

imp:	mov.i #4,1

	end start

; The P-brain takes 40 cycles maximum to execute, 45 on first round.

;redcode
;name Tumzi
;author Zul Nadzri
;assert 1
;strategy 1. Fake warrior at the front
;strategy 2. Continuous scanning for the second warrior
;strategy 3. Added PIN to manipulate master-slave loop hole (it's legal!)
;strategy 4. For Round 13 Tournament only
;strategy Some redundancy and wasteful lines but not worth to be optimised.
;-----------------------------------------------------------
PIN 103
num1	equ 15
num2	equ 5					;must be in base 5
timer	equ 33				;monitoring location for jmn
away	equ -17
ctrtop equ 11
ctrbot equ 11

;-----------------------------------------------------------
;		fake codes - a place other people call "home"
;-----------------------------------------------------------
fakespace 	equ 50
fake2 	equ -fakespace-3
fake3		equ fake2+2
fake4		equ fakespace+1
verytop 	dat -cnt,cnt

		for fakespace
		dat -cnt,cnt
		rof

    		mov ptr , >ptr				;48
    		mov ptr , {ptr				;49
cnt 		djn -2  , #fake2				;50
ptr 		dat fake3  , fake4			;51
cage		dat 0,0					;52

		for fakespace
		dat cnt,-cnt-1
		rof

		for 4
		dat 0,0
		rof

start2	stp #5, #5
		jmp start

		for 3
		dat 0,0
		rof

;-------------------------------------------------------------
;		main program - the fragile pumping heart
;-------------------------------------------------------------
incr	dat #-num1, #num1
scan	add incr, start 
start	sne -179+verytop-5,179+verybot+6
	jmp -2

	mov.i start, loc2			;save for next cycle
	seq.i bong, *start		;if equal, then a-field is blank
	jmp n					;if not equal blank, a-field is useful

m	mov.i @start, loc1		;assume b-value has the correct number
	add.b loc1, start			;adjusting - value relative to our value

k	mov.i @start, loc3		;move the probe to our temporary cell
	nop 0,0				;delay timer
	nop 0,0				;delay timer
	mov.i @start, loc1		;move the probe to our temporary cell
	sne.i loc1, loc3			;compare changes
	jmp kill				

	sub #1, start			;adjusting - specific subject's location for probe
	mov.i @start, loc3		;move the probe to our comparison cell
	seq.i loc3, ctr1			;compare subject with our database
	jmp kill
	
copy	add #3, start			;if match with counter, get the 'free' cell location
	mov bing, @start			;stun enemy is already jump to the free cell

	sub #10, start			;readjust our destination cell
	mov bong, @start			;initiating
	mov.ab #26, dup			;put code's length
	mov our,<start			;transfering
	sub.a #1, -1			;adjust a-field
dup	djn -2, #26				;cycle
	mov start, loc1
	sub #32, loc1			;send enemy here
	mov.ba @-1, bing
	mov hehe, cage
	add #2, start			;readjust to first execute cell
	jmp @start				;jump there

hehe	jmp bing-cage

;-----------------------------------------------------------
;		copy cells - the place where we commit suicide
;-----------------------------------------------------------
	dat 0,0
	dat 0,0

new	add #15+115+5, turbo 
turbo	sne.i -2,3+1000
	jmz -2, -4
	jmp 2

temp	dat 0,0
	
	mov.ba turbo, jumper
	mul.a #-1, jumper
	add.a #18, jumper
	jmp 2

	dat 0,0

	mov jumper, @turbo
	jmz new, new-2
	jmp salsa
jumper jmp 30,30

bong	dat 0,0				;xxx bombed xxx

salsa	mov bing, away
home	mov our, away
	mov ejump, bing
	jmp 2, }18

bing	jmp 0,0				;xxx bombed xxx
	
	mov 4, 14
	jmp @home, <5
ejump	jmp away-4, }19
our	jmn 0, timer

;-----------------------------------------------------------
;		new line - a welcome note from the host
;-----------------------------------------------------------
n	mov.i *start, loc1		;save number in location 1
	add.a start, loc1			;adjusting - value relative to our value
	mul #-1, loc1			;adjusting - bring to positive number
	mov.ab loc1, start		;adjusting - point to scan location
	jmp k

kill	mov.ba start, tgt			;
	mov.b start, tgt
	sub diff, tgt
	mul.a #-1, tgt 
	mov tgt, @tgt			;fang out
carp	add #1, tgt
	mov pit2, >tgt			;point cell to fang location
	mov pit2, >tgt			;point cell to fang location
	mov pit2, >tgt			;point cell to fang location
	mov loc2, start
	jmp scan
tgt	jmp 0, 3500	 			;fang pointer
diff	dat #54,#54+21

;-----------------------------------------------------------
;		junkyard - some lines that shouldn't exist
;-----------------------------------------------------------

pit2	jmp -1

loc1	dat 0,0				;found a code at this location
loc2	dat 0,0				;our current scan step
loc3	dat 0,0				;white warrior ("mov 2, {2") to validate genuine
ctr1	mov 2, {2
loc4	dat 0,0

verybot 	dat 0,0

end start2

;redcode-odd
;name Sayembara FC
;author Zul Nadzri
;assert 1
;strategy - Round 21 Tournament "The Football Game"
;strategy - Passing game, 4-4-2 formation, soft tackling
;strategy - First half, quick-passing the ball, samba style
;strategy - Midfielders passing ball around to control the game
;strategy - Strikers aim for goal and strike at first opportunity
;strategy - If winning, switch to 5-4-1 formation and play super defensive

;--- Players have enough warm-up and ready. Any second now, and.....KICKOFF!

value equ 3456  ; just for Koenigstuhl [CCB]

goal 	equ value
ball 	equ value
top 	equ shift-100
bot 	equ shift+200

shift dat #-3, #-3

;--- Quick pass, samba style. The opposing players seem confused.
	jmp.b #0, #ball
	jmp.b #0, #goal+3
	jmp.b #0, #ball
	jmp.b #0, #goal+2
	jmp.b #0, #ball
	jmp.b #0, #goal+1

;--- Midfielders pass the ball around. Switching to the other wing.
decoy spl start
	mov balltest, 2000	;3004-8
	mov balltest, 4000	;5235-9
	mov balltest, 6000-1	;1925-10
	mov balltest, 4227-11	;6555-11
	mov goaltest, 1000	;725-12
	mov goaltest, 3000	;7235-13
	mov goaltest, 5000	;1405-14
	mov goaltest, 7000	;7214-15
	dat 0,0

;--- Attacking, Midfielders look for open strikers.
incr	dat #-20, #20
reset	seq.i top-10, bot+20
next	add incr, start
start	seq.i top, bot+10
	jmp found
	add incr, start
	seq.i *start, @start
	jmp found
	add incr, start
	seq.i *start, @start
	jmp found
	add incr, start
	seq.i *start, @start
	jmp found
	add incr, start
	seq.i *start, @start
	jmp found
cycle	djn next, #76
	mov.i reset, start
	mov.ab #74, -2
	add shift, reset
	djn start, #11

;--- Switch to 5-4-1 formation and change tactic to Defensive.
slow	sne.i balltest, goaltest
	jmp 3
	add #1, slow
	djn slow, #7800
	mov.ba slow, fang
	mul.a #-1, fang
	add.a #score, fang
	mov fang, @slow
	jmp 0,0 		;All players guard the penalty area
	
;--- Strikers attempt a shot!
found	sne.i balltest, *start
	jmp bfang		;One to one with the keeper, a good chance to score.
	spl spawn
	mov stun, *start	;Volley from outside the penalty area...Ohh..just over the bar!
	dat 0,0
spawn	sne.i balltest, @start
	jmp bfang		;Striker beats his marker and one to one with the keeper!
	spl cycle
	mov stun, @start	;Good header but hit the goalpost...again!
	dat 0,0
	
fang	jmp scan, #999
poison dat bfang-start, bfang-start
adjust dat field-fang, field-fang
inverse dat #-1, #-1
field dat 0,0

bfang	mov.i start, field	
	sub poison, field
	sub adjust, field
	mov.a field, fang
	mul.a #-1, fang
	add.a #scan, fang
	spl more
	mov.i fang, *start
	dat 0,0
more	spl cycle
	mov.a start, fang
	sub.ba start, fang
	mov.i fang, @start
	dat 0,0

;--- A powerful shot towards the goal! Can the goalkeeper parry it?
steps equ 780
step1	equ 10
ptrs	equ 70
ptrs2 equ ptrs+step1/2

cls 	dat 0,0
stun 	jmp #0, #2000
kill 	sne.i	goaltest, @ptrh
	mov.i cls, @ptrh
	mov.i stun, @ptrh
	add #-1, ptrh+1
a    	add #step1, ptrh
scan 	seq.i cls, @ptrh
ptrh	jmp kill, ptrs
	djn a, #steps
	add #steps, -1
	mov.ab #ptrs2, ptrh
	jmp a, }-1

;--- GOALLLLLLLLLLLLLLLLLLLLL! Beautiful shot!!
score mov.i -1, 0

;--- Referee is looking at his watch...and, blows the final whistle.
	dat 0,0

	jmp.b #0, #ball
	jmp.b #0, #goal+3
	jmp.b #0, #ball
	jmp.b #0, #goal+2
	jmp.b #0, #ball
	jmp.b #0, #goal+1

balltest jmp.b #0, #ball
goaltest jmp.b #0, #goal

end decoy
;end start


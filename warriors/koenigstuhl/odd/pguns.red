;redcode-tiny quiet
;name PGuns
;author Zul Nadzri
;strategy Bombers+Dclear. Round 22 RFT.
;assert 1
;       CORESIZE==800
;strategy Last minute submission. Done in 1 hour.

;------------------------------------------------ Dumb Pswitch
switch ldp #0, #0
	seq #0, -1
	jmp win
lost	ldp.a #5, win
	add.a #1, win
	mod.a #3, win
	mov.a win, 1
	stp #0, #5
win	jmp 0, }0
	jmp n3262515

;------------------------------------------------ Guns 
start	mov {400, >420
	mov {380, >440
	mov {360, >460
	mov {340, >480
	mov {320, >500
	mov {300, >520
	mov {280, >540
	mov {260, >560
	mov {240, >580
	mov {220, >600
	mov {200, >620

for   4
	mov 5, 300
rof
	jmp 300-4, }500 

clr 	spl #0, 0
	mov 2,>-4
	djn.f -1,>-5
	dat <267,5+4

;------------------------------------------------ White Noise
n3262514:
	add.f $n3262517+0, @n3262518+0
n3262515:
	sne.i }n3262515+733, $n3262515+727
n3262516:
	djn.f $n3262514+0, {n3262516+50
n3262517:
	spl.b #n3262517+774, {n3262517+774
n3262518:
	mov.i @n3262521+0, >n3262515+0
n3262519:
	mov.i @n3262521+0, >n3262516+0
	mov.i @n3262521+0, >n3262516+0
n3262521:
	djn.x $n3262519+0, {n3262523+0
n3262522:
	dat.f #n3262522+619, }n3262530+0
n3262523:
	spl.b #n3262523+775, $n3262518+17
n3262524:
	spl.x #n3262524+1, $n3262524+1
	mov.i @n3262527+0, >n3262522+148
	spl.b #n3262516+480, >n3262524+396
n3262527:
	spl.b #n3262517+248, >n3262527+396
n3262528:
	spl.x $n3262528+1, $n3262528+1
n3262529:
	spl.x #n3262529+1, $n3262529+1
n3262530:
	mov.i @n3262532+0, >n3262527+148
n3262531:
	spl.x #n3262531+1, $n3262531+1
n3262532:
	spl.x $n3262532+1, }n3262532+1
n3262533:
	spl.x $n3262533+1, $n3262533+1

;end start 
end switch
	

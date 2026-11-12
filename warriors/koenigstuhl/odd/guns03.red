;redcode-tiny quiet
;name Gun + Gun 03
;author Zul Nadzri
;strategy Bomber. Round 22 RFT.
;assert 1
;       CORESIZE==800

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

end start 
	

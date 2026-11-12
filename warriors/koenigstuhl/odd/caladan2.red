;redcode-b verbose
;name Caladan II
;author Ingo S Kacza
;strategy Stone/Imp 
;strategy submitted @date@
;assert CORESIZE == 8000 && MAXLENGTH >= 100
; KOFACOTO-1
;alte Caladan Optimierung
; dieses programm ist als caladan II im Hill
; hat als impschutz mal gegen isle ramses gekaempft
; Ratiosuche
;        r-s		22-55-23--2144
;      r-r-s		17-38-44--2315
;    r-r-r-s		25-28-48--2935
;  r-r-r-r-s		24-22-55--3002
;r-r-r-r-r-s		23-20-57--3027
;r-s-r-r-r-r		24-22-54--3024
;1-1-r-s		23-44-33--2469
;  r-r-r-r-1-s		25-20-55--3093
;Combination
;  r-r-r-r-1-s-js	27-19-54--3207---mit decoy 30xx
;mit Stone von Baseline	24-21-55--3049---komisch
;  r-r-r-r-1-1-js	25-22-55--3081
;  r-r-r-r-1-s-jss	25-22-54--3058
;i-r-r-r-r-1-s-js	24-20-56--3080
;  r-r-r-r-1-s-s-js	26-20-54--3164
;    r-r-r-1-s-s-js	25-21-54--3115
;0-r-r-r-s-s		
;r-r-r-r-0-s		23-22-55--2958
;r-r-r-r-1-s-s-0-jr	14-20-66--2606
;r-r-r-r-1-s-s-0-js	22-22-56--2895
;r-r-r-r-1-s-s-0-jss	
;r-r-r-s-s-js
;r-r-r-1-s-s-js
;        r-s		22-55-23--2144
;    r-s-r-s		24-47-29--2403
;r-s-r-s-r-s		24-43-33--2517
;s-r
;s-s-r
;s-s-s-r
;s-s-s-s-r
;1-1-r-1-1-s
;s-r-r-r-r-1-js		26-21-53--3167
;      r-r-r-1-s-js	
;combination 
;dec -2000	25-20-55--3104
;mov.f		16-19-65--2708
;mov #120, 0	22-60-18--2006
; spl 1, jmp 1, jmp s  15247
; spl 1, spl 1, jmp s  15795
; spl 1, spl s, jmp s 15861 --> Caladan II
; spl 1 spl 2 jmp 1 jmp s 15581        

step 	equ 2667

       	spl r
	spl r
	spl r
 	spl r
 	spl 1
        spl s
	jmp s

; endlich mal prozesse hinter einander

	for 20
	dat 0,0
	rof

;stone (Leto)	

s	spl #693, #-693
ss	add -1, 1
	mov <10,-10	 
	djn.f -2, <-3000
	for 20
	dat 0,0
	rof

;ring

r	spl 4
	spl 2
	jmp 4
	jmp 2670
	jmp 1
	jmp 5335
imp	mov 0, step


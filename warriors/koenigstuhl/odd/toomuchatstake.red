;redcode-94
;name TooMuchAtStake
;author Robert Macrae
;strategy 0.66c vamp/SPL bomber
;assert 1

;    Based on MyVamp5.4

;    Interleaves SPL bombs and scans 5 apart.  
;    Actually SPLs aren't very effective against other vamps, eg MyVamp5.4 beats this 
;    because it's JMP <core> bombs are better against single-process warriors

;    OTOH I haven't put in an SSD clear so can't handle replicators... Hmmm.
;    Constants picked with a pin.
;    Still it works and I'm out of time!


st              equ     30
patst           equ     (30*17)
pitoffs		equ     (patst+stop-pit)  
fangoffs		equ     (pitoffs+5) 	



pit             spl     #0,{0    
                spl     #0,0 
                mov.i   pit-1,>pclr     	;should suicide after 32000 or so?
pclr           	jmp     pit+1,#30 

	          	dat.f   0,0			;SCAN

trap            jmp     -pitoffs,0	

            	dat.f   0,0
ptr             dat.f   0,0
                dat.f   0,0
                dat.f   0,0                ;FANG


next            sub.f   step,pit+fangoffs
start           mov.i   @0,>pit+fangoffs   
                jmz.f   next,*pit+fangoffs
                mov.i   step,*pit+fangoffs
stop            jmz.f   next,pit           ; SPL bomb here to finish.  SCAN
step            spl     #st,-st+1
                mov.i   bmb,>ptr
                djn.f   -1,>ptr

                dat.f   0,0
                dat.f   0,0              	;FANG
bmb             dat.f   0,15

boot			mov.i   trap,pit+pitoffs
                mov.i   fang,pit+fangoffs ;SCAN
                jmp     start,0
			 
fang            jmp     *-patst-5-st,patst+st       				
										   
                end     boot

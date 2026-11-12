;redcode-tiny
;name White Spikes Sneaky Noise
;author Zul Nadzri
;strategy When White Noise meets Sneaky Spikes
;strategy (aka White Noise without the bait)
;assert 1

step	 equ -67
incr   equ -26

top    add    dclear	, @bar
start  sne    }step	, step-6
clear  djn.f  top		, {50
   
dclear spl    #incr	, {incr
bar    mov    @ptr	, >start
loop   mov    @ptr	, >clear
       mov    @ptr	, >clear
ptr    djn.x  loop	, {stun

bomb   dat    #-181	, }8    
stun   spl    #-25	, $12

	 end start  
 

;redcode-rf21
;name eisern_union
;assert 1

value equ 3456  ; just for Koenigstuhl [CCB]

goal equ value
ball equ value

;find the goal
a sne.ab #goal, -1
 jmp b
 jmp a, <a

;find the ball
b sne.ab #ball, -4
 jmp shot
 jmp b, <b

;calculate the distance and
shot mov.b a, sw
 sub.b b, sw
 sub #3, sw
 mov sw, @b 

 jmp 0 ;do nothing after the shot
                  ;just watch the ball flying...   

sw mov.i -1, 0
 
end



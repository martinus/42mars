;redcode-soccer
;name Boston United
;author John Metcalf
;strategy 1.5c search for ball or goal, record the position
;strategy until both are located.  Shoot, and if this fails
;strategy drop through to DAT...
;strategy v2 - fixed a small bug
;assert 1
 
value equ 3456  ; just for Koenigstuhl [CCB]

goal equ value
ball equ value

loop    sne     }seek,  }seek
        jmz.f   loop,   }seek
seek    jmz.f   #200,   {seek

        sne     #ball,  *seek
        jmp     fball,  }seek

        seq     #goal,  }seek
        jmp     loop,   }seek
fgoal   mov.a   seek,   pos
        sub.a   #1+pos-seek,pos
        jmz     loop,   pos
        jmp     shoot

fball   mov.ab  seek,   pos
        sub     #1+pos-seek,pos
        jmz.a   loop,   pos
 
shoot   mov.ab  pos,    bomb
        sub.b   pos,    bomb
        mov     bomb,   @pos
 
bomb    mov     @22,    0
pos     dat     0,      0

        end


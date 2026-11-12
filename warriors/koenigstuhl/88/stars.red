;redcode-88
;name Stars
;author Samuel Owens
;strategy carpet stun bomb, switches to core wipe
;assert CORESIZE == 8000
 
pos equ 94
distance equ 299
 
start stars
splt    spl 0, pos
begin   add #distance, splt
        mov splt, @splt
        jmp begin, <start-3     ;stun bomb will land here
        mov bomb, <bomb
bomb    dat <start-3, #start    ;a field imp gate
end stars


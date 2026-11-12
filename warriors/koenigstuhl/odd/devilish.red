;redcode-94x
;name devilish
;author David Houston
;assert CORESIZE % 20 == 0 

offsetA equ -17 
offsetB equ -9 
stepA equ -7 
stepB equ -7 
frame equ 20 

stone:   spl #frame * stepA, <frame * stepB 
ptr:     mov bomb, @bomb + 6 + frame * offsetA 
        mov bomb, @ptr 
        mov bomb, *ptr 
        add.f -4, -3 
        jmp stone + 1, <stone + frame * stepB 
bomb:    dat 0, -13 + 20 * offsetB 

end stone 

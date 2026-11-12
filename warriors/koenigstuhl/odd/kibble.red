;name Kibble-2
;author SilverWingedSeraph
;strategy A modification on self-destructive self-replication
;strategy   with an imp-stomper to defend the factory, as well as
;strategy   0-based self destruct for each replica to foil time-
;strategy   sucking attacks
;assert 1

        org     isstart
; Imp Stomper to protect the factory from lucky strikes
isstart spl     start
istomp  mov     #0      , -1
        jmp     $istomp

; Starting here things get replicated
; Guard data is checked each run, if it is 
;   nonzero the replica kills itself
guard   dat     #0      , #0
start   mov.ab  #12     , $guard      
copy    mov.i   @guard  , <5       
        djn.b   $copy   , $guard      
spawn   spl.b   @pos    , $0       
        add     #1810    , $pos       
; Integrity check
icheck  jmz     $start  , $guard
; Position of next copy
pos     dat     #0      , #1024

interface Animation {
    /**
     * returns true when done
     */
    (t: number, forceEnd?: boolean): boolean;
}
